import fs from "node:fs";
import { AGENT_DIRS, agentPath } from "../paths";
import { atomicWrite, joinSections, splitSections, type Section } from "./markdown";

/**
 * marketing/inputs/keywords.md has two user-owned sections (keywords, trends the user noticed). The Research and
 * Posting agents read it; the Dashboard is the only writer, so it keeps the file's own headings and comments.
 */

const KEYWORDS = /الكلمات المفتاحية/;
const TRENDS = /ترندات/;

export type Keywords = { keywords: string[]; trends: string[] };

const TEMPLATE = `# الكلمات المفتاحية والترندات

> فاضي، بتملّيه إنت. الـ Research Agent بيقراه، والـ Posting Agent بيستخدمه للهاشتاجات.

## الكلمات المفتاحية
<!-- كلمة أو عبارة في كل سطر -->
-

## ترندات بعتّها بنفسي
<!-- الترند + الرابط أو المصدر + التاريخ لو معاك -->
-
`;

function file(): string {
  return agentPath(AGENT_DIRS.inputs, "keywords.md");
}

function bullets(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("*"))
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function readKeywords(): Keywords {
  const text = fs.existsSync(file()) ? fs.readFileSync(file(), "utf8") : TEMPLATE;
  const { sections } = splitSections(text);
  return {
    keywords: bullets(sections.find((s) => KEYWORDS.test(s.heading))?.content ?? ""),
    trends: bullets(sections.find((s) => TRENDS.test(s.heading))?.content ?? ""),
  };
}

function render(section: Section | undefined, heading: string, items: string[]): Section {
  const comments = (section?.content ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("<!--"));
  const list = items.length ? items.map((item) => `- ${item.replace(/\r?\n/g, " ").trim()}`) : ["-"];
  return { heading: section?.heading ?? heading, content: [...comments, ...list].join("\n") };
}

export function writeKeywords(next: Keywords): void {
  const text = fs.existsSync(file()) ? fs.readFileSync(file(), "utf8") : TEMPLATE;
  const { preamble, sections } = splitSections(text);
  const rest = sections.filter((s) => !KEYWORDS.test(s.heading) && !TRENDS.test(s.heading));
  const out = [
    render(sections.find((s) => KEYWORDS.test(s.heading)), "الكلمات المفتاحية", next.keywords),
    render(sections.find((s) => TRENDS.test(s.heading)), "ترندات بعتّها بنفسي", next.trends),
    ...rest,
  ];
  atomicWrite(file(), joinSections(preamble, out));
}
