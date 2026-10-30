import fs from "node:fs";
import { agentPath } from "../paths";
import { atomicWrite, setFrontmatter, splitFrontmatter } from "./markdown";
import { addSnapshot, latestSnapshot } from "../db";
import type { StyleName } from "@/lib/stages";

export const STYLE_NAMES: StyleName[] = ["script-style", "montage-style"];

export function isStyleName(value: string): value is StyleName {
  return (STYLE_NAMES as string[]).includes(value);
}

export function stylePath(name: StyleName): string {
  return agentPath("marketing", "style", `${name}.md`);
}

export function readStyle(name: StyleName): string {
  const file = stylePath(name);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

export function isTrained(content: string): boolean {
  return splitFrontmatter(content).fm.trained === "true";
}

/** Makes sure the first version of a style file is in the history, so the very first edit can be diffed/restored. */
export function ensureBaseline(name: StyleName): void {
  if (!latestSnapshot(name)) addSnapshot(name, readStyle(name), "baseline", "النسخة الأصلية");
}

export function writeStyle(name: StyleName, content: string, source: "manual" | "example" | "trained" | "restore", note?: string): void {
  ensureBaseline(name);
  atomicWrite(stylePath(name), content);
  addSnapshot(name, content, source, note);
}

export function withTrained(content: string, trained: boolean, dateISO: string): string {
  return setFrontmatter(content, { trained: String(trained), last_updated: dateISO });
}

/** Cells in a markdown table row can't contain raw pipes or line breaks. */
function cell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

/**
 * Inserts `insertion` at the end of the `## ` section whose heading matches `test` (right before the next `## `
 * heading), leaving every other byte of the file untouched. Returns null when the section doesn't exist.
 */
export function insertAtEndOfSection(content: string, test: RegExp, insertion: string): string | null {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => /^##(?!#)\s/.test(line) && test.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##(?!#)\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // keep trailing blank lines (and a `---` rule) after the inserted block
  let insertAt = end;
  while (insertAt > start + 1 && (lines[insertAt - 1].trim() === "" || lines[insertAt - 1].trim() === "---")) insertAt--;
  lines.splice(insertAt, 0, ...insertion.split("\n"));
  return lines.join("\n");
}

/** Appends a row to the Training Log table (creating the section if the file doesn't have one). */
export function appendTrainingLog(content: string, row: { date: string; input: string; rule: string }): string {
  const line = `| ${cell(row.date)} | ${cell(row.input)} | ${cell(row.rule)} |`;
  const inserted = insertAtEndOfSection(content, /Training Log/i, line);
  if (inserted !== null) return inserted;
  const table = `\n## Training Log\n\n| التاريخ | التصحيح / المثال | القاعدة المستخلصة |\n|---|---|---|\n${line}\n`;
  return content.replace(/\s*$/, "\n") + table;
}

/** Adds a script, verbatim, under "7. أمثلة سكريبتات ممتازة" and logs it. `trained` is never touched. */
export function appendScriptExample(content: string, example: { title: string; text: string; date: string }): string {
  const block = `\n### مثال: ${example.title.replace(/\r?\n/g, " ")} (${example.date})\n\n${example.text.trim()}\n`;
  const withExample = insertAtEndOfSection(content, /أمثلة سكريبتات ممتازة/, block);
  const base = withExample ?? content.replace(/\s*$/, "\n") + `\n## أمثلة سكريبتات ممتازة\n${block}`;
  return appendTrainingLog(base, {
    date: example.date,
    input: `مثال محفوظ من الـ Dashboard: ${example.title}`,
    rule: "راجع المثال في قسم الأمثلة الممتازة (لم تُستخلص قاعدة بعد)",
  });
}
