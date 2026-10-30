import {
  findSection,
  joinSections,
  normalizeDigits,
  replaceSection,
  splitFrontmatter,
  splitSections,
  setFrontmatter,
  type Frontmatter,
  type Section,
} from "../files/markdown";
import {
  countWords,
  DEFAULT_WORDS_PER_SECOND,
  describeDuration,
  estimateSeconds,
  hasPlaceholders,
  HOOK_SECONDS,
  stripWordCountNotes,
  type DurationInfo,
  type ScriptParts,
} from "@/lib/script-math";

export { countWords, DEFAULT_WORDS_PER_SECOND, describeDuration, estimateSeconds, hasPlaceholders, HOOK_SECONDS };
export type { DurationInfo, ScriptParts };

export type ParsedScript = {
  header: Frontmatter;
  title: string;
  durationLine: string;
  parts: ScriptParts;
  /** Everything needed to write the file back without disturbing unknown sections. */
  raw: { preamble: string; sections: Section[] };
};

const HOOK = /^Hook/i;
const BODY = /^المحتوى/;
const CTA = /^CTA/i;
const MISSING = /^معلومات ناقصة/;
const DURATION = /^\*\*المدة التقريبية:?\*\*:?.*$/m;

export function parseScript(text: string): ParsedScript {
  const { fm, body } = splitFrontmatter(text);
  const { preamble, sections } = splitSections(body);
  const title = (preamble.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();
  const durationLine = (preamble.match(DURATION)?.[0] ?? "").trim();
  const get = (test: RegExp) => findSection(sections, test)?.content ?? "";
  const spoken = (test: RegExp) => stripWordCountNotes(get(test)).trim();
  return {
    header: fm,
    title,
    durationLine,
    parts: { hook: spoken(HOOK), body: spoken(BODY), cta: spoken(CTA), missing: get(MISSING) },
    raw: { preamble, sections },
  };
}

/** Reads "معدل الكلام (كلمة/ثانية): 2.8" from script-style.md; null while the user hasn't filled it in. */
export function parseSpeakingRate(styleText: string): number | null {
  const match = normalizeDigits(styleText).match(/معدل الكلام[^:\n]*:\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function durationLineFor(info: DurationInfo): string {
  const source = info.rateIsAssumed ? "افتراض مؤقت" : "من script-style";
  return `**المدة التقريبية:** ~${info.seconds} ثانية (${info.words} كلمة ÷ ${info.rate} كلمة/ث، المعدل: ${source}، معدّل من الـ Dashboard)`;
}

/** Writes edited Hook / المحتوى / CTA back into the file, refreshing the duration line and keeping the rest as is. */
export function serializeScript(source: string, parts: Pick<ScriptParts, "hook" | "body" | "cta">, info: DurationInfo): string {
  const parsed = parseScript(source);
  let sections = parsed.raw.sections;
  sections = replaceSection(sections, HOOK, "Hook (0–3ث)", parts.hook);
  sections = replaceSection(sections, BODY, "المحتوى", parts.body);
  sections = replaceSection(sections, CTA, "CTA", parts.cta);

  const line = durationLineFor(info);
  const preamble = DURATION.test(parsed.raw.preamble)
    ? parsed.raw.preamble.replace(DURATION, line)
    : `${parsed.raw.preamble}\n\n${line}`;

  const text = joinSections(preamble, sections);
  return Object.keys(parsed.header).length ? setFrontmatter(text, parsed.header) : text;
}
