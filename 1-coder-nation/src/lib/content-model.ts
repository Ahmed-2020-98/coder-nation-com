// The editable page text as data: validation built from the field specs, the defaults (src/content/ar.ts) and the
// result the public page renders: the defaults with whatever the admin saved on top. Pure functions, no database, so
// it is unit-tested directly; src/server/content.ts adds the storage and the cache around it.

import { z } from "zod";
import type { SiteContent } from "@/content";
import { ar } from "@/content/ar";
import {
  HIDEABLE_SECTIONS,
  NUMBERED_SECTIONS,
  SECTION_ANCHOR,
  SECTION_IDS,
  SECTION_SPECS,
  isSafeHref,
  type FieldSpec,
  type SectionId,
} from "./content-spec";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- validation, built from the specs ----------

const REQUIRED = "الحقل ده مطلوب";
const tooLong = (max: number) => `الحد الأقصى ${max} حرف`;
const tooShort = (min: number) => `${min} أحرف على الأقل`;

function textSchema(max: number, min: number, multiline: boolean, pattern?: { re: RegExp; message: string }) {
  // Line endings are normalised and the ends trimmed BEFORE the length checks, so "  " counts as empty.
  const body = z.string(REQUIRED).transform((value) => value.replace(/\r\n?/g, "\n").trim());
  let checked = z.string().max(max, tooLong(max));
  // Empty reads "required"; only a too-short, non-empty value says how many characters are needed (first message wins).
  if (min >= 1) checked = checked.min(1, REQUIRED);
  if (min > 1) checked = checked.min(min, tooShort(min));
  if (!multiline) checked = checked.regex(/^[^\n]*$/, "من غير سطور جديدة");
  if (pattern) checked = checked.regex(pattern.re, pattern.message);
  return body.pipe(checked);
}

function fieldSchema(spec: FieldSpec): z.ZodType {
  switch (spec.kind) {
    case "text":
    case "area":
      return textSchema(spec.max, spec.optional ? 0 : (spec.min ?? 1), spec.kind === "area", spec.kind === "text" ? spec.pattern : undefined);
    case "href":
      return z
        .string(REQUIRED)
        .trim()
        .refine(
          (value) => (spec.optional && value === "") || isSafeHref(value, spec.httpsOnly),
          spec.httpsOnly ? "الرابط لازم يبدأ بـ https://" : "رابط غير صالح (استخدم #قسم أو /مسار أو https:// أو mailto: أو tel:)",
        );
    case "select": {
      const values = spec.options.map((option) => option.value) as [string, ...string[]];
      return z.enum(values, "اختيار غير صالح");
    }
    case "bool":
      return z.boolean("قيمة غير صالحة");
    case "image":
      return z.string("صورة غير صالحة").refine((value) => value === "" || UUID_RE.test(value), "صورة غير صالحة");
    case "hidden":
      return z.string().regex(spec.pattern, "قيمة غير صالحة");
    case "strings":
      return z.array(textSchema(spec.itemMax, 1, false), "قيمة غير صالحة").min(spec.min, `${spec.min} على الأقل`).max(spec.max, `الحد الأقصى ${spec.max}`);
    case "group":
      return z.object(shapeOf(spec.fields));
    case "list":
      return z
        .array(z.object(shapeOf(spec.fields)), "قيمة غير صالحة")
        .min(spec.min, spec.min === 1 ? "لازم يبقى فيه عنصر واحد على الأقل" : `${spec.min} عناصر على الأقل`)
        .max(spec.max, `الحد الأقصى ${spec.max}`);
  }
}

function shapeOf(fields: Record<string, FieldSpec>): Record<string, z.ZodType> {
  return Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key, fieldSchema(spec)]));
}

const schemas = new Map<SectionId, z.ZodObject<Record<string, z.ZodType>>>();
/** What a section must look like to be saved. Unknown keys are dropped, never stored. */
export function sectionSchema(id: SectionId) {
  let schema = schemas.get(id);
  if (!schema) {
    schema = z.object(shapeOf(SECTION_SPECS[id].fields));
    schemas.set(id, schema);
  }
  return schema;
}

/** Zod issues as `{ "items.2.title": "message" }`, the keys the editor form puts on its inputs. First message wins. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".") || "_"] ??= issue.message;
  return out;
}

// ---------- defaults and merging ----------

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain => typeof value === "object" && value !== null && !Array.isArray(value);

function pickValue(spec: FieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case "group":
      return pickFields(spec.fields, value);
    case "list":
      return Array.isArray(value) ? value.map((item) => pickFields(spec.fields, item)) : [];
    case "strings":
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    case "bool":
      return value === true;
    case "select":
      return typeof value === "string" ? value : spec.options[0].value;
    default:
      return typeof value === "string" ? value : "";
  }
}

/** Only the fields the specs describe, in spec order, with a value of the right kind for each. */
export function pickFields(fields: Record<string, FieldSpec>, source: unknown): Plain {
  const from = isPlain(source) ? source : {};
  return Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key, pickValue(spec, from[key])]));
}

/** The editable part of a section as the code ships it. */
export function defaultsFor(id: SectionId): Plain {
  return pickFields(SECTION_SPECS[id].fields, (ar as unknown as Record<string, unknown>)[id]);
}

/** `stored` laid over `defaults`: objects merge key by key, arrays and scalars are replaced whole. */
export function deepDefaults(defaults: unknown, stored: unknown): unknown {
  if (isPlain(defaults) && isPlain(stored)) {
    const out: Plain = { ...defaults };
    for (const [key, value] of Object.entries(stored)) out[key] = deepDefaults(defaults[key], value);
    return out;
  }
  return stored === undefined ? defaults : stored;
}

/**
 * A stored section that is valid now, or null. A broken one (hand-edited table) is ignored whole. A field added to the
 * spec after the section was saved is filled with its empty value first (lists are stored whole, so their items would
 * otherwise lack it), so adding an optional field never throws away what the admin saved.
 */
export function parseStoredSection(id: SectionId, stored: unknown): Plain | null {
  const parsed = sectionSchema(id).safeParse(pickFields(SECTION_SPECS[id].fields, deepDefaults(defaultsFor(id), stored)));
  return parsed.success ? (parsed.data as Plain) : null;
}

// ---------- what the page shows ----------

/** What is kept in the database: the saved sections (each one complete) and the sections switched off. */
export type StoredContent = { sections: Record<string, unknown>; hidden: string[] };
export const EMPTY_STORED: StoredContent = { sections: {}, hidden: [] };

export type SiteView = {
  content: SiteContent;
  /** Sections not on the page: switched off in the admin, or left with nothing to show. */
  hidden: SectionId[];
  /** The "// 01" number of each section on the page. */
  indexes: Partial<Record<SectionId, string>>;
};

const isEmptySection = (id: SectionId, content: SiteContent): boolean => {
  switch (id) {
    case "services":
      return content.services.items.length === 0;
    case "why":
      return content.why.diff.length + content.why.reasons.length === 0;
    case "process":
      return content.process.steps.length === 0;
    case "work":
      return content.work.items.length === 0;
    case "testimonials":
      return content.testimonials.items.length === 0;
    case "faq":
      return content.faq.items.length === 0;
    default:
      return false;
  }
};

/** Normalises whatever came out of the database (it is `unknown`: anyone with table access can write anything). */
export function normalizeStored(raw: unknown): StoredContent {
  if (!isPlain(raw)) return EMPTY_STORED;
  const sections = isPlain(raw.sections) ? raw.sections : {};
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((id): id is string => typeof id === "string") : [];
  return { sections, hidden };
}

export function computeView(stored: StoredContent = EMPTY_STORED): SiteView {
  const merged: Plain = { ...(ar as unknown as Plain) };
  for (const id of SECTION_IDS) {
    if (stored.sections[id] === undefined) continue;
    const parsed = parseStoredSection(id, stored.sections[id]);
    if (parsed) merged[id] = { ...(merged[id] as Plain), ...parsed };
  }
  const content = merged as unknown as SiteContent;

  const hidden = HIDEABLE_SECTIONS.filter((id) => stored.hidden.includes(id) || isEmptySection(id, content));
  const indexes: SiteView["indexes"] = {};
  let n = 0;
  for (const id of NUMBERED_SECTIONS) {
    if ((hidden as readonly SectionId[]).includes(id)) continue;
    indexes[id] = String(++n).padStart(2, "0");
  }
  return { content, hidden, indexes };
}

/** True for a link that points at a section that is not on the page ("#work" while "work" is hidden). */
export const isLinkHidden = (href: string, hidden: readonly SectionId[]): boolean => hidden.some((id) => href === `#${SECTION_ANCHOR[id]}`);

export const visibleLinks = <T extends { href: string }>(links: readonly T[], hidden: readonly SectionId[]): T[] => links.filter((link) => !isLinkHidden(link.href, hidden));

/** Every uploaded image the stored content points at (the rest of the `media` table is garbage). */
export function referencedMediaIds(stored: StoredContent): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (UUID_RE.test(value)) found.add(value.toLowerCase());
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (isPlain(value)) Object.values(value).forEach(walk);
  };
  walk(stored.sections);
  return found;
}
