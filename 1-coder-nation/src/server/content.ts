import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type postgres from "postgres";
import {
  EMPTY_STORED,
  computeView,
  defaultsFor,
  fieldErrors,
  normalizeStored,
  parseStoredSection,
  referencedMediaIds,
  sectionSchema,
  type SiteView,
  type StoredContent,
} from "@/lib/content-model";
import { HIDEABLE_SECTIONS, type SectionId } from "@/lib/content-spec";
import { sql } from "./db";
import { purgeOrphanMedia } from "./media";

export const CONTENT_TAG = "content";
// The editable page text is one JSON document in `settings`, next to the 'site' one (src/server/settings.ts).
const KEY = "content";

/** Straight from the database (admin screens). Throws if the database is unavailable. */
export async function readStored(): Promise<StoredContent> {
  const [row] = await sql()<{ value: unknown }[]>`select value from settings where key = ${KEY}`;
  return normalizeStored(row?.value);
}

/**
 * What the public page renders. Cached and tagged: saving in the admin calls updateTag("content"), so changes show
 * immediately; otherwise it refreshes every 5 minutes. With no database yet, or while it is down, the page shows the
 * text that ships with the code, so a visitor never sees an error because of this.
 */
export async function getSiteView(): Promise<SiteView> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });
  try {
    return computeView(await readStored());
  } catch {
    return computeView(EMPTY_STORED);
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Read-modify-write under a row lock, so two admins saving different sections cannot overwrite each other. */
async function mutate(update: (stored: StoredContent) => StoredContent): Promise<void> {
  const db = sql();
  const next = await db.begin(async (tx) => {
    await tx`insert into settings (key, value) values (${KEY}, ${tx.json(EMPTY_STORED as unknown as postgres.JSONValue)}) on conflict (key) do nothing`;
    const [row] = await tx<{ value: unknown }[]>`select value from settings where key = ${KEY} for update`;
    const updated = update(normalizeStored(row?.value));
    await tx`update settings set value = ${tx.json(updated as unknown as postgres.JSONValue)}, updated_at = now() where key = ${KEY}`;
    return updated;
  });
  // Housekeeping only: a failure here must never fail the save.
  await purgeOrphanMedia(referencedMediaIds(next)).catch((error) => console.error("[media-purge]", error instanceof Error ? error.message : error));
}

export async function saveSection(id: SectionId, value: unknown): Promise<SaveResult> {
  const parsed = sectionSchema(id).safeParse(value);
  if (!parsed.success) return { ok: false, error: "في حقول محتاجة تصحيح", fieldErrors: fieldErrors(parsed.error) };
  // Saving exactly the shipped text is the same as having no override: the section goes back to "default".
  const same = JSON.stringify(parsed.data) === JSON.stringify(defaultsFor(id));
  await mutate((stored) => {
    const sections = { ...stored.sections };
    if (same) delete sections[id];
    else sections[id] = parsed.data;
    return { ...stored, sections };
  });
  return { ok: true };
}

export async function resetSection(id: SectionId): Promise<SaveResult> {
  await mutate((stored) => {
    const sections = { ...stored.sections };
    delete sections[id];
    return { ...stored, sections };
  });
  return { ok: true };
}

export async function setSectionHidden(id: SectionId, hidden: boolean): Promise<SaveResult> {
  if (!(HIDEABLE_SECTIONS as readonly string[]).includes(id)) return { ok: false, error: "القسم ده مينفعش يتخفّى" };
  await mutate((stored) => {
    const rest = stored.hidden.filter((entry) => entry !== id);
    return { ...stored, hidden: hidden ? [...rest, id] : rest };
  });
  return { ok: true };
}

/** What the editor opens with: the saved section if there is a valid one, otherwise the shipped text. */
export function currentSection(id: SectionId, stored: StoredContent): { value: Record<string, unknown>; modified: boolean } {
  const parsed = stored.sections[id] === undefined ? null : parseStoredSection(id, stored.sections[id]);
  return parsed ? { value: parsed, modified: true } : { value: defaultsFor(id), modified: false };
}
