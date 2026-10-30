import fs from "node:fs";
import path from "node:path";
import { AGENT_DIRS, agentPath, todayISO, toAgentRelative } from "../paths";
import {
  describeDuration,
  hasPlaceholders,
  parseScript,
  parseSpeakingRate,
  serializeScript,
  type DurationInfo,
  type ScriptParts,
} from "../parse/script";
import { scriptEditJob, scriptJob } from "../agents/prompts";
import { startRun } from "../jobs";
import { patchCard, type Card, type Run } from "../db";
import { appendScriptExample, isTrained, readStyle, writeStyle } from "../files/style";
import { outputExists, readOutput, requireCard, requireStage, ServiceError, updateOutputHeader, writeOutput } from "./common";

export type ScriptVersion = { file: string; version: number; modifiedAt: string; status: string };

function versionPattern(slug: string): RegExp {
  return new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-v(\\d+))?\\.md$`);
}

export function scriptVersions(slug: string): ScriptVersion[] {
  const dir = agentPath(AGENT_DIRS.scripts);
  if (!fs.existsSync(dir)) return [];
  const pattern = versionPattern(slug);
  return fs
    .readdirSync(dir)
    .flatMap((name) => {
      const match = name.match(pattern);
      if (!match) return [];
      const absolute = path.join(dir, name);
      const status = parseScript(fs.readFileSync(absolute, "utf8")).header.status ?? "draft";
      return [{ file: toAgentRelative(absolute), version: match[1] ? Number(match[1]) : 1, modifiedAt: fs.statSync(absolute).mtime.toISOString(), status }];
    })
    .sort((a, b) => a.version - b.version || a.modifiedAt.localeCompare(b.modifiedAt));
}

const nextVersion = (slug: string): number => Math.max(1, ...scriptVersions(slug).map((v) => v.version)) + 1;

export function startScript(cardId: string): Run {
  const card = requireCard(cardId);
  requireStage(card, ["idea", "script"], "الكارت اتجاوز مرحلة السكريبت");
  if (!card.ideaFile || card.ideaNo === null) throw new ServiceError(409, "الكارت مش مربوط بفكرة معتمدة");
  if (outputExists(card.scriptFile, "scripts")) {
    throw new ServiceError(409, "فيه سكريبت بالفعل للكارت ده. استخدم «تعديل بالـ AI» لعمل نسخة جديدة.");
  }
  return startRun({
    cardId: card.id,
    label: card.slug,
    job: scriptJob({ ideasFile: card.ideaFile, ideaNo: card.ideaNo, slug: card.slug, date: todayISO(), question: card.ideaQuestion ?? card.title }),
    onSuccess: ({ outputFile }) => {
      if (!outputFile) throw new Error("لا يوجد ملف سكريبت");
      patchCard(card.id, { scriptFile: outputFile, stage: "script" });
    },
  });
}

export function startScriptEdit(cardId: string, notes: string): Run {
  const card = requireCard(cardId);
  requireStage(card, ["script"], "التعديل بالـ AI متاح لما الكارت يكون في مرحلة السكريبت. أرجعه لها الأول.");
  if (!card.scriptFile || !outputExists(card.scriptFile, "scripts")) throw new ServiceError(409, "لا يوجد سكريبت لتعديله");
  const trimmed = notes.trim();
  if (trimmed.length < 3) throw new ServiceError(400, "اكتب ملاحظات التعديل");
  return startRun({
    cardId: card.id,
    label: `${card.slug} (تعديل)`,
    job: scriptEditJob({ previousFile: card.scriptFile, slug: card.slug, date: todayISO(), version: nextVersion(card.slug), notes: trimmed.slice(0, 2000) }),
    onSuccess: ({ outputFile }) => {
      if (!outputFile) throw new Error("لا يوجد ملف سكريبت");
      patchCard(card.id, { scriptFile: outputFile });
    },
  });
}

export type ScriptView = {
  card: Card;
  versions: ScriptVersion[];
  style: { rate: number | null; trained: boolean };
  script: {
    file: string;
    title: string;
    status: string;
    preTraining: boolean;
    simulated: boolean;
    parts: ScriptParts;
    duration: DurationInfo;
    hasPlaceholders: boolean;
    editable: boolean;
  } | null;
};

export function getScriptView(cardId: string): ScriptView {
  const card = requireCard(cardId);
  const styleText = readStyle("script-style");
  const rate = parseSpeakingRate(styleText);
  const versions = scriptVersions(card.slug);
  const style = { rate, trained: isTrained(styleText) };
  if (!card.scriptFile || !outputExists(card.scriptFile, "scripts")) return { card, versions, style, script: null };

  const parsed = parseScript(readOutput(card.scriptFile, "scripts"));
  return {
    card,
    versions,
    style,
    script: {
      file: card.scriptFile,
      title: parsed.title,
      status: parsed.header.status ?? "draft",
      preTraining: parsed.header.pre_training === "true",
      simulated: parsed.header.simulated === "true",
      parts: parsed.parts,
      duration: describeDuration(parsed.parts, rate),
      hasPlaceholders: hasPlaceholders(`${parsed.parts.hook}\n${parsed.parts.body}\n${parsed.parts.cta}`),
      editable: card.stage === "script",
    },
  };
}

export function saveScript(cardId: string, parts: Pick<ScriptParts, "hook" | "body" | "cta">): ScriptView {
  const card = requireCard(cardId);
  requireStage(card, ["script"], "السكريبت اتعتمد وانتقل لمرحلة تانية. أرجع الكارت لمرحلة السكريبت الأول لو عايز تعدّله.");
  if (!card.scriptFile) throw new ServiceError(409, "لا يوجد سكريبت");
  const source = readOutput(card.scriptFile, "scripts");
  const info = describeDuration(parts, parseSpeakingRate(readStyle("script-style")));
  writeOutput(card.scriptFile, "scripts", serializeScript(source, parts, info));
  return getScriptView(cardId);
}

export function pickVersion(cardId: string, file: string): ScriptView {
  const card = requireCard(cardId);
  requireStage(card, ["script"], "اختيار النسخة متاح في مرحلة السكريبت بس");
  if (!scriptVersions(card.slug).some((version) => version.file === file)) throw new ServiceError(404, "النسخة دي مش تابعة للكارت");
  patchCard(card.id, { scriptFile: file });
  return getScriptView(cardId);
}

/** The approval gate of the Script stage. Unfilled `[يحدده صاحب المشروع: …]` placeholders need an explicit `force`. */
export function approveScript(cardId: string, force: boolean): Card {
  const card = requireCard(cardId);
  requireStage(card, ["script"], "الكارت مش في مرحلة السكريبت");
  if (!card.scriptFile) throw new ServiceError(409, "لا يوجد سكريبت لاعتماده");
  const parsed = parseScript(readOutput(card.scriptFile, "scripts"));
  const { hook, body, cta } = parsed.parts;
  if (!hook.trim() || !body.trim()) throw new ServiceError(400, "السكريبت ناقص: لازم Hook ومحتوى");
  if (hasPlaceholders(`${hook}\n${body}\n${cta}`) && !force) {
    throw new ServiceError(409, "فيه معلومات ناقصة بين [ ] لسه ماكمّلتهاش. كمّلها أو اعتمد رغم كده.", "needs_force");
  }
  updateOutputHeader(card.scriptFile, "scripts", { status: "approved" });
  return patchCard(card.id, { stage: "filming" });
}

/** "احفظ كمثال لأسلوبي": copies the script verbatim into script-style.md (section 7 + Training Log). */
export function saveAsExample(cardId: string): { title: string } {
  const card = requireCard(cardId);
  if (!card.scriptFile) throw new ServiceError(409, "لا يوجد سكريبت لحفظه");
  const parsed = parseScript(readOutput(card.scriptFile, "scripts"));
  const { hook, body, cta } = parsed.parts;
  if (!hook.trim() && !body.trim()) throw new ServiceError(400, "السكريبت فاضي");
  const title = parsed.title || card.title;
  const text = `**Hook**\n${hook}\n\n**المحتوى**\n${body}\n\n**CTA**\n${cta}`;
  const date = todayISO();
  writeStyle("script-style", appendScriptExample(readStyle("script-style"), { title, text, date }), "example", `مثال: ${title}`);
  return { title };
}
