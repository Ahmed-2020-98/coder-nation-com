import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Frontmatter = Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text: string): { fm: Frontmatter; body: string } {
  const match = text.match(FRONTMATTER);
  if (!match) return { fm: {}, body: text };
  const fm: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: text.slice(match[0].length) };
}

/** Updates (or appends) keys in the frontmatter block without touching anything else in the file. */
export function setFrontmatter(text: string, updates: Frontmatter): string {
  const match = text.match(FRONTMATTER);
  if (!match) {
    const lines = Object.entries(updates).map(([key, value]) => `${key}: ${value}`);
    return `---\n${lines.join("\n")}\n---\n${text}`;
  }
  const pending: Frontmatter = { ...updates };
  const lines = match[1].split(/\r?\n/).map((line) => {
    const i = line.indexOf(":");
    if (i > 0) {
      const key = line.slice(0, i).trim();
      if (key in pending) {
        const value = pending[key];
        delete pending[key];
        return `${key}: ${value}`;
      }
    }
    return line;
  });
  for (const [key, value] of Object.entries(pending)) lines.push(`${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n${text.slice(match[0].length)}`;
}

export type Section = { heading: string; content: string };

const H2 = /^##(?!#)\s+(.*?)\s*$/;

/** Splits a markdown body into the text before the first `## ` heading and the `## ` sections after it. */
export function splitSections(body: string): { preamble: string; sections: Section[] } {
  const lines = body.split(/\r?\n/);
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const match = line.match(H2);
    if (match) {
      if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
      current = { heading: match[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
  return { preamble: preamble.join("\n").trim(), sections };
}

export function joinSections(preamble: string, sections: Section[]): string {
  const parts = [preamble.trim()].filter(Boolean);
  for (const section of sections) {
    parts.push(`## ${section.heading}\n${section.content.trim()}`.trimEnd());
  }
  return `${parts.join("\n\n")}\n`;
}

export function findSection(sections: Section[], test: RegExp): Section | undefined {
  return sections.find((section) => test.test(section.heading));
}

/** Replaces the content of the first section matching `test`; appends a new section when none matches. */
export function replaceSection(sections: Section[], test: RegExp, heading: string, content: string): Section[] {
  const index = sections.findIndex((section) => test.test(section.heading));
  if (index === -1) return [...sections, { heading, content }];
  return sections.map((section, i) => (i === index ? { heading: section.heading, content } : section));
}

export type Table = { header: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  const placeholder = "\u0000";
  const cells = line
    .trim()
    .replace(/\\\|/g, placeholder)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|");
  return cells.map((cell) => cell.replaceAll(placeholder, "|").trim());
}

/** Parses the first GitHub-style table found in `content`. */
export function parseTable(content: string): Table | null {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const header = splitRow(lines[i]);
      const rows: string[][] = [];
      for (let j = i + 2; j < lines.length && lines[j].trim().startsWith("|"); j++) {
        rows.push(splitRow(lines[j]));
      }
      return { header, rows };
    }
  }
  return null;
}

/** Arabic-Indic / Persian digits -> ASCII, so numbers written either way parse the same. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٪/g, "%");
}

export function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = normalizeDigits(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Writes through a temp file + rename so a crash never leaves a half-written markdown file. */
export function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, file);
}
