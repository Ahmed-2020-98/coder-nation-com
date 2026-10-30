import {
  findSection,
  joinSections,
  replaceSection,
  setFrontmatter,
  splitFrontmatter,
  splitSections,
  type Frontmatter,
} from "../files/markdown";

export type PostParts = {
  caption: string;
  /** Hashtags that come from marketing/inputs/keywords.md. */
  keywordTags: string[];
  /** Hashtags the agent suggested itself (unverified). */
  suggestedTags: string[];
  timing: string;
};

export type ParsedPost = {
  header: Frontmatter;
  title: string;
  parts: PostParts;
  statusText: string;
};

const CAPTION = /^الكابشن/;
const TAGS = /^الهاشتاجات/;
const TIMING = /^وقت النشر/;
const STATE = /^حالة النشر/;

function extractTags(line: string): string[] {
  const found = line.match(/#[^\s#,،؛;]+/g);
  return found ? [...new Set(found)] : [];
}

export function parsePost(text: string): ParsedPost {
  const { fm, body } = splitFrontmatter(text);
  const { preamble, sections } = splitSections(body);
  const keywordTags: string[] = [];
  const suggestedTags: string[] = [];

  for (const line of (findSection(sections, TAGS)?.content ?? "").split(/\r?\n/)) {
    if (/مقترحة|غير موثّق/.test(line)) suggestedTags.push(...extractTags(line));
    else keywordTags.push(...extractTags(line));
  }

  return {
    header: fm,
    title: (preamble.match(/^#\s+(.+)$/m)?.[1] ?? "").trim(),
    parts: {
      caption: findSection(sections, CAPTION)?.content ?? "",
      keywordTags,
      suggestedTags,
      timing: findSection(sections, TIMING)?.content ?? "",
    },
    statusText: findSection(sections, STATE)?.content ?? "",
  };
}

function normalizeTag(tag: string): string {
  const clean = tag.trim().replace(/^#+/, "");
  return clean ? `#${clean}` : "";
}

/** Writes the edited caption / hashtags / timing back into the file, keeping every other section. */
export function serializePost(source: string, parts: PostParts): string {
  const { fm, body } = splitFrontmatter(source);
  const parsed = splitSections(body);
  let sections = parsed.sections;
  const tagLines = [
    `- من الكلمات المفتاحية: ${parts.keywordTags.map(normalizeTag).filter(Boolean).join(" ")}`.trimEnd(),
    `- مقترحة (غير موثّقة): ${parts.suggestedTags.map(normalizeTag).filter(Boolean).join(" ")}`.trimEnd(),
  ].join("\n");

  sections = replaceSection(sections, CAPTION, "الكابشن", parts.caption);
  sections = replaceSection(sections, TAGS, "الهاشتاجات", tagLines);
  sections = replaceSection(sections, TIMING, "وقت النشر المقترح", parts.timing);

  const text = joinSections(parsed.preamble, sections);
  return Object.keys(fm).length ? setFrontmatter(text, fm) : text;
}
