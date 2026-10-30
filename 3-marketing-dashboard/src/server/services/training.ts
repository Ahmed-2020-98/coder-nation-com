import { diffLines } from "diff";
import { todayISO } from "../paths";
import { addSnapshot, getSnapshot, listSnapshots, type StyleSnapshot } from "../db";
import { appendTrainingLog, ensureBaseline, isStyleName, isTrained, readStyle, withTrained, writeStyle } from "../files/style";
import { splitFrontmatter } from "../files/markdown";
import { STYLE_LABEL, type StyleName } from "@/lib/stages";
import { ServiceError } from "./common";

export function parseStyleName(value: string): StyleName {
  if (!isStyleName(value)) throw new ServiceError(404, "ملف الـ style غير موجود");
  return value;
}

export type StyleView = {
  name: StyleName;
  label: string;
  content: string;
  trained: boolean;
  lastUpdated: string | null;
  history: Omit<StyleSnapshot, "content">[];
};

function summarize(snapshot: StyleSnapshot): Omit<StyleSnapshot, "content"> {
  const { content: _content, ...rest } = snapshot;
  void _content;
  return rest;
}

export function getStyleView(name: StyleName): StyleView {
  ensureBaseline(name);
  const content = readStyle(name);
  return {
    name,
    label: STYLE_LABEL[name],
    content,
    trained: isTrained(content),
    lastUpdated: splitFrontmatter(content).fm.last_updated || null,
    history: listSnapshots(name).map(summarize),
  };
}

/** Manual save from the editor. A note (optional) also becomes a Training Log row, as the terminal workflow does. */
export function saveStyle(name: StyleName, content: string, note: string | null): StyleView {
  if (!content.trim()) throw new ServiceError(400, "الملف فاضي");
  if (content.length > 200_000) throw new ServiceError(413, "الملف كبير جدًا");
  const trimmed = note?.trim() || null;
  const date = todayISO();
  const withLog = trimmed ? appendTrainingLog(content, { date, input: trimmed, rule: "تعديل يدوي من الـ Dashboard" }) : content;
  writeStyle(name, withFrontmatterDate(withLog, date), "manual", trimmed ?? undefined);
  return getStyleView(name);
}

function withFrontmatterDate(content: string, date: string): string {
  const { fm } = splitFrontmatter(content);
  return withTrained(content, fm.trained === "true", date);
}

/** Only an explicit user action flips `trained` (the Training page asks for confirmation first). */
export function setTrained(name: StyleName, trained: boolean): StyleView {
  const date = todayISO();
  const updated = withTrained(readStyle(name), trained, date);
  writeStyle(name, updated, "trained", trained ? "تم تعليم الملف كمُدرَّب" : "رجوع لحالة غير مُدرَّب");
  return getStyleView(name);
}

export function restoreSnapshot(name: StyleName, snapshotId: number): StyleView {
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot || snapshot.file !== name) throw new ServiceError(404, "النسخة غير موجودة");
  writeStyle(name, snapshot.content, "restore", `استرجاع نسخة ${snapshot.createdAt.slice(0, 16).replace("T", " ")}`);
  return getStyleView(name);
}

export type DiffLine = { type: "add" | "remove" | "same" | "skip"; text: string };

/** Line diff between two stored versions (or a version and the current file), collapsing long unchanged runs. */
export function diffVersions(name: StyleName, fromId: number, toId: number | "current"): { lines: DiffLine[]; added: number; removed: number } {
  const from = getSnapshot(fromId);
  if (!from || from.file !== name) throw new ServiceError(404, "النسخة غير موجودة");
  const target = toId === "current" ? readStyle(name) : getSnapshot(toId)?.content;
  if (target === undefined) throw new ServiceError(404, "النسخة غير موجودة");

  const flat: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  for (const part of diffLines(from.content, target)) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    const type = part.added ? "add" : part.removed ? "remove" : "same";
    if (part.added) added += lines.length;
    if (part.removed) removed += lines.length;
    for (const text of lines) flat.push({ type, text });
  }

  const CONTEXT = 2;
  const out: DiffLine[] = [];
  let i = 0;
  while (i < flat.length) {
    if (flat[i].type !== "same") {
      out.push(flat[i++]);
      continue;
    }
    let j = i;
    while (j < flat.length && flat[j].type === "same") j++;
    const run = flat.slice(i, j);
    const first = i === 0;
    const last = j === flat.length;
    const keepHead = first ? 0 : CONTEXT;
    const keepTail = last ? 0 : CONTEXT;
    if (run.length > keepHead + keepTail + 1) {
      out.push(...run.slice(0, keepHead), { type: "skip", text: `… ${run.length - keepHead - keepTail} سطر بدون تغيير …` }, ...run.slice(run.length - keepTail));
    } else {
      out.push(...run);
    }
    i = j;
  }
  return { lines: out, added, removed };
}

export { addSnapshot };
