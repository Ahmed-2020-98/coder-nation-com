import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { env } from "./env";
import type { RunKind, RunStatus, RunStep, Stage, StyleName } from "@/lib/stages";

/**
 * SQLite (Node's built-in `node:sqlite`, no native dependency) holds the dashboard's STATE only: cards and their
 * stage, run history, schedule, style-edit history. The CONTENT (ideas, scripts, plans, posts, style files) stays
 * in the agents' markdown files so the terminal workflow keeps working on the same data.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'idea',
  idea_file TEXT, idea_no INTEGER, idea_question TEXT, idea_hook TEXT,
  script_file TEXT, shotlist_file TEXT, montage_file TEXT, post_file TEXT,
  footage_name TEXT, footage_original TEXT, final_video_path TEXT,
  scheduled_at TEXT, published_url TEXT, published_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  label TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  cost_usd REAL,
  error TEXT,
  output_file TEXT,
  steps TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS style_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  content TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_card ON runs(card_id);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_style_file ON style_snapshots(file, id);
`;

declare global {
  var __dashboardDb: DatabaseSync | undefined;
}

const now = () => new Date().toISOString();

function open(): DatabaseSync {
  fs.mkdirSync(env.dataDir, { recursive: true });
  const database = new DatabaseSync(path.join(env.dataDir, "dashboard.db"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA);
  // A run still marked active when the process starts can never finish: the process that owned it is gone.
  database
    .prepare("UPDATE runs SET status = 'failed', error = ?, ended_at = ? WHERE status IN ('queued', 'running')")
    .run("توقف السيرفر أثناء التشغيل", now());
  return database;
}

/** One connection per process (survives Next.js hot reloads in dev). */
export function db(): DatabaseSync {
  return (globalThis.__dashboardDb ??= open());
}

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" ? value : null);

// ---------- cards ----------

export type Card = {
  id: string;
  slug: string;
  title: string;
  stage: Stage;
  ideaFile: string | null;
  ideaNo: number | null;
  ideaQuestion: string | null;
  ideaHook: string | null;
  scriptFile: string | null;
  shotlistFile: string | null;
  montageFile: string | null;
  postFile: string | null;
  footageName: string | null;
  footageOriginal: string | null;
  finalVideoPath: string | null;
  scheduledAt: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toCard(row: Row): Card {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    stage: String(row.stage) as Stage,
    ideaFile: text(row.idea_file),
    ideaNo: num(row.idea_no),
    ideaQuestion: text(row.idea_question),
    ideaHook: text(row.idea_hook),
    scriptFile: text(row.script_file),
    shotlistFile: text(row.shotlist_file),
    montageFile: text(row.montage_file),
    postFile: text(row.post_file),
    footageName: text(row.footage_name),
    footageOriginal: text(row.footage_original),
    finalVideoPath: text(row.final_video_path),
    scheduledAt: text(row.scheduled_at),
    publishedUrl: text(row.published_url),
    publishedAt: text(row.published_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const CARD_COLUMNS: Record<keyof Omit<Card, "id" | "createdAt" | "updatedAt">, string> = {
  slug: "slug",
  title: "title",
  stage: "stage",
  ideaFile: "idea_file",
  ideaNo: "idea_no",
  ideaQuestion: "idea_question",
  ideaHook: "idea_hook",
  scriptFile: "script_file",
  shotlistFile: "shotlist_file",
  montageFile: "montage_file",
  postFile: "post_file",
  footageName: "footage_name",
  footageOriginal: "footage_original",
  finalVideoPath: "final_video_path",
  scheduledAt: "scheduled_at",
  publishedUrl: "published_url",
  publishedAt: "published_at",
};

export function listCards(): Card[] {
  return db().prepare("SELECT * FROM cards ORDER BY updated_at DESC").all().map(toCard);
}

export function getCard(id: string): Card | null {
  const row = db().prepare("SELECT * FROM cards WHERE id = ?").get(id);
  return row ? toCard(row) : null;
}

export function getCardBySlug(slug: string): Card | null {
  const row = db().prepare("SELECT * FROM cards WHERE slug = ?").get(slug);
  return row ? toCard(row) : null;
}

export type NewCard = Pick<Card, "slug" | "title"> & Partial<Pick<Card, "ideaFile" | "ideaNo" | "ideaQuestion" | "ideaHook">>;

export function createCard(input: NewCard): Card {
  const id = randomUUID();
  const stamp = now();
  db()
    .prepare(
      `INSERT INTO cards (id, slug, title, stage, idea_file, idea_no, idea_question, idea_hook, created_at, updated_at)
       VALUES (?, ?, ?, 'idea', ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.slug, input.title, input.ideaFile ?? null, input.ideaNo ?? null, input.ideaQuestion ?? null, input.ideaHook ?? null, stamp, stamp);
  return getCard(id)!;
}

export type CardPatch = Partial<Omit<Card, "id" | "createdAt" | "updatedAt">>;

export function patchCard(id: string, patch: CardPatch): Card {
  const entries = Object.entries(patch).filter(([key]) => key in CARD_COLUMNS);
  if (entries.length > 0) {
    const sets = entries.map(([key]) => `${CARD_COLUMNS[key as keyof typeof CARD_COLUMNS]} = ?`);
    const values = entries.map(([, value]) => (value === undefined ? null : value) as SQLInputValue);
    db()
      .prepare(`UPDATE cards SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
      .run(...values, now(), id);
  }
  const card = getCard(id);
  if (!card) throw new Error("الكارت غير موجود");
  return card;
}

// ---------- runs ----------

export type Run = {
  id: string;
  cardId: string | null;
  kind: RunKind;
  status: RunStatus;
  label: string | null;
  startedAt: string;
  endedAt: string | null;
  costUsd: number | null;
  error: string | null;
  outputFile: string | null;
  steps: RunStep[];
};

function toRun(row: Row): Run {
  let steps: RunStep[] = [];
  try {
    steps = JSON.parse(String(row.steps ?? "[]")) as RunStep[];
  } catch {
    steps = [];
  }
  return {
    id: String(row.id),
    cardId: text(row.card_id),
    kind: String(row.kind) as RunKind,
    status: String(row.status) as RunStatus,
    label: text(row.label),
    startedAt: String(row.started_at),
    endedAt: text(row.ended_at),
    costUsd: num(row.cost_usd),
    error: text(row.error),
    outputFile: text(row.output_file),
    steps,
  };
}

export function createRun(input: { cardId: string | null; kind: RunKind; label?: string }): Run {
  const id = randomUUID();
  db()
    .prepare("INSERT INTO runs (id, card_id, kind, status, label, started_at) VALUES (?, ?, ?, 'queued', ?, ?)")
    .run(id, input.cardId, input.kind, input.label ?? null, now());
  return getRun(id)!;
}

export function getRun(id: string): Run | null {
  const row = db().prepare("SELECT * FROM runs WHERE id = ?").get(id);
  return row ? toRun(row) : null;
}

export function listRuns(filter: { cardId?: string; limit?: number } = {}): Run[] {
  const limit = filter.limit ?? 50;
  const rows = filter.cardId
    ? db().prepare("SELECT * FROM runs WHERE card_id = ? ORDER BY started_at DESC LIMIT ?").all(filter.cardId, limit)
    : db().prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?").all(limit);
  return rows.map(toRun);
}

export function activeRunFor(cardId: string | null, kinds?: RunKind[]): Run | null {
  const rows = cardId
    ? db().prepare("SELECT * FROM runs WHERE card_id = ? AND status IN ('queued','running')").all(cardId)
    : db().prepare("SELECT * FROM runs WHERE card_id IS NULL AND status IN ('queued','running')").all();
  const runs = rows.map(toRun);
  return runs.find((run) => !kinds || kinds.includes(run.kind)) ?? null;
}

/** True when a finished or running run already owns this output file (so another run must not claim it). */
export function isOutputClaimed(file: string): boolean {
  const row = db().prepare("SELECT 1 AS hit FROM runs WHERE output_file = ? LIMIT 1").get(file);
  return Boolean(row);
}

export function countActiveRuns(): number {
  const row = db().prepare("SELECT COUNT(*) AS n FROM runs WHERE status IN ('queued','running')").get();
  return Number(row?.n ?? 0);
}

export function updateRun(
  id: string,
  patch: Partial<Pick<Run, "status" | "endedAt" | "costUsd" | "error" | "outputFile" | "steps">>,
): void {
  const sets: string[] = [];
  const values: SQLInputValue[] = [];
  const add = (column: string, value: SQLInputValue) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.endedAt !== undefined) add("ended_at", patch.endedAt);
  if (patch.costUsd !== undefined) add("cost_usd", patch.costUsd);
  if (patch.error !== undefined) add("error", patch.error);
  if (patch.outputFile !== undefined) add("output_file", patch.outputFile);
  if (patch.steps !== undefined) add("steps", JSON.stringify(patch.steps));
  if (sets.length === 0) return;
  db()
    .prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, id);
}

// ---------- style history ----------

export type StyleSnapshot = {
  id: number;
  file: StyleName;
  content: string;
  note: string | null;
  source: "baseline" | "manual" | "example" | "trained" | "restore";
  createdAt: string;
};

function toSnapshot(row: Row): StyleSnapshot {
  return {
    id: Number(row.id),
    file: String(row.file) as StyleName,
    content: String(row.content),
    note: text(row.note),
    source: String(row.source) as StyleSnapshot["source"],
    createdAt: String(row.created_at),
  };
}

export function addSnapshot(file: StyleName, content: string, source: StyleSnapshot["source"], note?: string): StyleSnapshot {
  const result = db()
    .prepare("INSERT INTO style_snapshots (file, content, note, source, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(file, content, note ?? null, source, now());
  return getSnapshot(Number(result.lastInsertRowid))!;
}

export function getSnapshot(id: number): StyleSnapshot | null {
  const row = db().prepare("SELECT * FROM style_snapshots WHERE id = ?").get(id);
  return row ? toSnapshot(row) : null;
}

export function listSnapshots(file: StyleName): StyleSnapshot[] {
  return db().prepare("SELECT * FROM style_snapshots WHERE file = ? ORDER BY id DESC").all(file).map(toSnapshot);
}

export function latestSnapshot(file: StyleName): StyleSnapshot | null {
  const row = db().prepare("SELECT * FROM style_snapshots WHERE file = ? ORDER BY id DESC LIMIT 1").get(file);
  return row ? toSnapshot(row) : null;
}
