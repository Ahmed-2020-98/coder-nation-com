import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AGENT_DIRS, agentPath, toAgentRelative, todayISO } from "../paths";
import { parseIdeas, type ParsedIdeas } from "../parse/ideas";
import { splitFrontmatter } from "../files/markdown";
import {
  parseTabular,
  pastedToLines,
  rowsToLines,
  writeCommentsFile,
  type Tabular,
} from "../files/comments";
import { readKeywords, writeKeywords, type Keywords } from "../files/keywords";
import { researchJob } from "../agents/prompts";
import { startRun } from "../jobs";
import type { Run } from "../db";
import { outputPath, readOutput, ServiceError } from "./common";

// ---------- keywords & trends ----------

export const getKeywords = (): Keywords => readKeywords();

export function saveKeywords(input: Keywords): Keywords {
  const clean = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 200);
  writeKeywords({ keywords: clean(input.keywords), trends: clean(input.trends) });
  return readKeywords();
}

// ---------- comments ----------

export type CommentFile = { file: string; batch: string; count: number; modifiedAt: string; analyzed: boolean };

export function listCommentFiles(): CommentFile[] {
  const dir = agentPath(AGENT_DIRS.inputs);
  if (!fs.existsSync(dir)) return [];
  const ideasDir = agentPath(AGENT_DIRS.ideas);
  const ideaNames = fs.existsSync(ideasDir) ? fs.readdirSync(ideasDir) : [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^comments-.*\.txt$/.test(name))
    .map((name) => {
      const absolute = path.join(dir, name);
      const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/).filter((line) => line.trim()).length;
      const batch = name.replace(/\.txt$/, "");
      return {
        file: toAgentRelative(absolute),
        batch,
        count: lines,
        modifiedAt: fs.statSync(absolute).mtime.toISOString(),
        analyzed: ideaNames.some((idea) => idea.includes(batch)),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function savePastedComments(text: string): { file: string; batch: string; count: number } {
  const lines = pastedToLines(text);
  if (lines.length === 0) throw new ServiceError(400, "الصق كومنت واحد على الأقل (كومنت في كل سطر)");
  return writeCommentsFile(lines, todayISO());
}

// Uploaded spreadsheets wait here (in memory, 15 minutes) between "preview columns" and "confirm columns".
type Pending = { table: Tabular; filename: string; expires: number };
declare global {
  var __dashboardUploads: Map<string, Pending> | undefined;
}
const pending = (): Map<string, Pending> => (globalThis.__dashboardUploads ??= new Map());

export type UploadPreview = {
  token: string;
  filename: string;
  columns: string[];
  sample: string[][];
  rowCount: number;
  truncated: boolean;
  encodingSuspect: boolean;
  /** Best guess so the common case is one click. */
  suggestedText: number;
  suggestedLikes: number | null;
};

export async function previewUpload(buffer: Buffer, filename: string): Promise<UploadPreview> {
  let table: Tabular;
  try {
    table = await parseTabular(buffer, filename);
  } catch (error) {
    throw new ServiceError(400, error instanceof Error ? error.message : "تعذّر قراءة الملف");
  }
  if (table.rows.length === 0) throw new ServiceError(400, "الملف مفيهوش صفوف بيانات بعد صف العناوين");

  const now = Date.now();
  for (const [key, entry] of pending()) if (entry.expires < now) pending().delete(key);
  const token = randomUUID();
  pending().set(token, { table, filename, expires: now + 15 * 60_000 });

  const guess = (pattern: RegExp) => table.columns.findIndex((name) => pattern.test(name));
  const text = guess(/comment|text|كومنت|تعليق|نص/i);
  const likes = guess(/like|لايك|اعجاب|إعجاب|reactions?/i);
  return {
    token,
    filename,
    columns: table.columns,
    sample: table.rows.slice(0, 5),
    rowCount: table.rows.length,
    truncated: table.truncated,
    encodingSuspect: table.encodingSuspect,
    suggestedText: text >= 0 ? text : 0,
    suggestedLikes: likes >= 0 && likes !== text ? likes : null,
  };
}

export function confirmUpload(token: string, textColumn: number, likesColumn: number | null) {
  const entry = pending().get(token);
  if (!entry) throw new ServiceError(410, "انتهت صلاحية الملف المرفوع، ارفعه تاني");
  if (textColumn < 0 || textColumn >= entry.table.columns.length) throw new ServiceError(400, "عمود الكومنتات غير صالح");
  if (likesColumn !== null && (likesColumn < 0 || likesColumn >= entry.table.columns.length)) {
    throw new ServiceError(400, "عمود اللايكات غير صالح");
  }
  const lines = rowsToLines(entry.table.rows, textColumn, likesColumn);
  if (lines.length === 0) throw new ServiceError(400, "العمود المختار مفيهوش كومنتات");
  pending().delete(token);
  return writeCommentsFile(lines, todayISO());
}

// ---------- analysis ----------

export function startResearch(commentsFile: string): Run {
  const absolute = outputPath(commentsFile, "inputs");
  if (!fs.existsSync(absolute) || !/^comments-.*\.txt$/.test(path.basename(absolute))) {
    throw new ServiceError(404, "ملف الكومنتات غير موجود");
  }
  const batch = path.basename(absolute).replace(/\.txt$/, "");
  return startRun({
    cardId: null,
    label: batch,
    job: researchJob({ commentsFile: toAgentRelative(absolute), batch, date: todayISO() }),
  });
}

// ---------- results ----------

export type IdeaBatch = {
  file: string;
  batch: string;
  created: string | null;
  status: string;
  total: number | null;
  ideaCount: number;
  selectedIdea: number | null;
  slug: string | null;
  simulated: boolean;
  preTraining: boolean;
  modifiedAt: string;
};

export function listIdeaBatches(): IdeaBatch[] {
  const dir = agentPath(AGENT_DIRS.ideas);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const absolute = path.join(dir, name);
      const text = fs.readFileSync(absolute, "utf8");
      const parsed = parseIdeas(text);
      const header = splitFrontmatter(text).fm;
      const selected = Number(header.selected_idea);
      return {
        file: toAgentRelative(absolute),
        batch: header.batch || name.replace(/\.md$/, ""),
        created: header.created || null,
        status: header.status || "draft",
        total: parsed.summary.total ?? (parsed.mappingCount || null),
        ideaCount: parsed.ideas.length,
        selectedIdea: Number.isFinite(selected) && selected > 0 ? selected : null,
        slug: header.slug || null,
        simulated: header.simulated === "true",
        preTraining: header.pre_training === "true",
        modifiedAt: fs.statSync(absolute).mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export type IdeasView = { file: string; parsed: ParsedIdeas; raw: string; simulated: boolean; preTraining: boolean };

export function getIdeasView(file: string): IdeasView {
  const raw = readOutput(file, "ideas");
  const parsed = parseIdeas(raw);
  return { file, parsed, raw, simulated: parsed.header.simulated === "true", preTraining: parsed.header.pre_training === "true" };
}
