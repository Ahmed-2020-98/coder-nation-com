import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { atomicWrite } from "./markdown";
import { AGENT_DIRS, agentPath, toAgentRelative } from "../paths";

export const MAX_COMMENT_ROWS = 20_000;

export type Tabular = {
  columns: string[];
  rows: string[][];
  truncated: boolean;
  /** True when the text contains many U+FFFD characters, i.e. the file probably isn't UTF-8. */
  encodingSuspect: boolean;
};

const clean = (value: unknown): string => String(value ?? "").replace(/﻿/g, "").trim();

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("result" in value) return clean(value.result);
    if ("text" in value) return clean(value.text);
  }
  return clean(value);
}

/** Reads a TXT / CSV / XLSX upload into a header row + data rows. The user picks the columns afterwards. */
export async function parseTabular(buffer: Buffer, filename: string): Promise<Tabular> {
  const extension = path.extname(filename).toLowerCase();
  let table: string[][];

  if (extension === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("الملف لا يحتوي على أي ورقة");
    table = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      table.push(values.map((value) => cellToString(value as ExcelJS.CellValue)));
    });
  } else if (extension === ".xls") {
    throw new Error("صيغة XLS القديمة غير مدعومة، احفظ الملف كـ XLSX أو CSV");
  } else if (extension === ".csv" || extension === ".txt") {
    const text = buffer.toString("utf8");
    if (extension === ".txt") {
      table = [["الكومنت"], ...text.split(/\r?\n/).map((line) => [clean(line)])];
    } else {
      const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
      table = parsed.data.map((row) => row.map(clean));
    }
  } else {
    throw new Error("الصيغ المدعومة: TXT وCSV وXLSX");
  }

  const encodingSuspect = (buffer.toString("utf8").match(/�/g) ?? []).length > 3;
  const width = Math.max(1, ...table.map((row) => row.length));
  const header = (table[0] ?? []).concat(Array(width).fill("")).slice(0, width);
  const columns = header.map((name, i) => name || `عمود ${i + 1}`);
  const data = table.slice(1).filter((row) => row.some((value) => value !== ""));
  return {
    columns,
    rows: data.slice(0, MAX_COMMENT_ROWS),
    truncated: data.length > MAX_COMMENT_ROWS,
    encodingSuspect,
  };
}

/** "1.2K" -> 1200, "3,400" -> 3400, "" -> null */
export function parseLikes(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "").toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!match) return null;
  const base = Number(match[1]);
  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  return Math.round(base * multiplier);
}

/** One comment per line, "text | likes" when likes are known (the format the Research Agent expects). */
export function formatCommentLine(text: string, likes: number | null): string {
  let body = text.replace(/\s+/g, " ").trim();
  if (!body) return "";
  // A comment that itself ends in "| 5" would be misread as a likes count.
  if (likes === null) body = body.replace(/\|\s*\d+\s*$/, (match) => match.replace("|", "/"));
  else body = body.replace(/\|/g, "/");
  return likes && likes > 0 ? `${body} | ${likes}` : body;
}

export function rowsToLines(rows: string[][], textColumn: number, likesColumn: number | null): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    const line = formatCommentLine(row[textColumn] ?? "", likesColumn === null ? null : parseLikes(row[likesColumn] ?? ""));
    if (line) lines.push(line);
  }
  return lines;
}

/** Pasted text: keep what the user wrote, one comment per line, drop blanks. */
export function pastedToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_COMMENT_ROWS);
}

function nextFilename(date: string): string {
  const dir = agentPath(AGENT_DIRS.inputs);
  let candidate = `comments-${date}.txt`;
  for (let n = 2; fs.existsSync(path.join(dir, candidate)); n++) candidate = `comments-${date}-${n}.txt`;
  return candidate;
}

/** Writes marketing/inputs/comments-YYYY-MM-DD[-n].txt and returns its agent-relative path. */
export function writeCommentsFile(lines: string[], date: string): { file: string; batch: string; count: number } {
  if (lines.length === 0) throw new Error("لا توجد كومنتات لحفظها");
  const name = nextFilename(date);
  const absolute = agentPath(AGENT_DIRS.inputs, name);
  atomicWrite(absolute, `${lines.join("\n")}\n`);
  return { file: toAgentRelative(absolute), batch: name.replace(/\.txt$/, ""), count: lines.length };
}
