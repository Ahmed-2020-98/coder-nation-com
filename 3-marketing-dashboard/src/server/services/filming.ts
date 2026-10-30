import fs from "node:fs";
import path from "node:path";
import { AGENT_DIRS, agentPath, todayISO, toAgentRelative } from "../paths";
import { parseScript } from "../parse/script";
import { parseMontage, type ParsedMontage } from "../parse/montage";
import { parseTable, splitFrontmatter } from "../files/markdown";
import { montageJob, shotListJob } from "../agents/prompts";
import { startRun } from "../jobs";
import { patchCard, type Card, type Run } from "../db";
import { footageDir, pruneFootage, saveFootage, UploadError } from "../files/uploads";
import { probeVideo, type VideoInfo } from "../files/video";
import { isTrained, readStyle } from "../files/style";
import { outputExists, readOutput, requireCard, requireStage, ServiceError, updateOutputHeader, writeOutput } from "./common";

function scriptIsApproved(card: Card): boolean {
  if (!card.scriptFile || !outputExists(card.scriptFile, "scripts")) return false;
  return parseScript(readOutput(card.scriptFile, "scripts")).header.status === "approved";
}

// ---------- shot list (Dashboard-owned prompt, not an agent) ----------

export function startShotList(cardId: string): Run {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "الـ Shot list بتتعمل بعد اعتماد السكريبت");
  if (!scriptIsApproved(card)) throw new ServiceError(409, "اعتمد السكريبت الأول");
  const date = todayISO();
  const relative = `${AGENT_DIRS.montage}/${date}-${card.slug}-shotlist.md`;
  return startRun({
    cardId: card.id,
    label: `${card.slug} (shot list)`,
    job: shotListJob({ scriptFile: card.scriptFile!, slug: card.slug }),
    onSuccess: ({ resultText }) => {
      const body = resultText.trim();
      if (!body) throw new Error("الـ Agent رجّع Shot list فاضية");
      const preTraining = !isTrained(readStyle("montage-style"));
      writeOutput(
        relative,
        "montage",
        `---\nstage: shotlist\nstatus: draft\npre_training: ${preTraining}\ncreated: ${date}\nslug: ${card.slug}\n---\n# Shot list: ${card.title}\n\n${body}\n`,
      );
      patchCard(card.id, { shotlistFile: relative });
    },
  });
}

// ---------- footage ----------

export async function uploadFootage(
  cardId: string,
  body: ReadableStream<Uint8Array> | null,
  originalName: string,
  declaredLength: number | null,
): Promise<{ original: string; sizeBytes: number; info: VideoInfo }> {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "رفع الفيديو متاح في مرحلة التصوير / المونتاج");
  const saved = await saveFootage(card.id, body, originalName, declaredLength);
  const info = await probeVideo(saved.absolute);
  if (!info) {
    fs.rmSync(saved.absolute, { force: true });
    throw new UploadError(415, "الملف مش فيديو صالح للقراءة (أو ffprobe مش متثبّت).");
  }
  pruneFootage(card.id, saved.name);
  const original = path.basename(originalName).slice(0, 200);
  patchCard(card.id, { footageName: saved.name, footageOriginal: original, montageFile: null });
  return { original, sizeBytes: saved.bytes, info };
}

// ---------- montage ----------

export function startMontage(cardId: string): Run {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "خطة المونتاج في مرحلة التصوير / المونتاج");
  if (!scriptIsApproved(card)) throw new ServiceError(409, "اعتمد السكريبت الأول");
  if (!card.footageName) throw new ServiceError(409, "ارفع الفيديو المتصور الأول");
  const footagePath = path.join(footageDir(card.id), card.footageName);
  if (!fs.existsSync(footagePath)) throw new ServiceError(409, "ملف الفيديو مش موجود على القرص، ارفعه تاني");
  return startRun({
    cardId: card.id,
    label: `${card.slug} (مونتاج)`,
    job: montageJob({ scriptFile: card.scriptFile!, footagePath, footageDir: footageDir(card.id), slug: card.slug, date: todayISO() }),
    onSuccess: ({ outputFile }) => {
      if (!outputFile) throw new Error("لا يوجد ملف خطة مونتاج");
      patchCard(card.id, { montageFile: outputFile });
    },
  });
}

export function approveMontage(cardId: string): Card {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "الكارت مش في مرحلة المونتاج");
  if (!card.montageFile || !outputExists(card.montageFile, "montage")) throw new ServiceError(409, "لا توجد خطة مونتاج لاعتمادها");
  updateOutputHeader(card.montageFile, "montage", { status: "approved" });
  return requireCard(card.id);
}

const FRAME_RE = /^marketing\/outputs\/montage\/[a-z0-9-]+\/frames[^/]*\/[A-Za-z0-9_.-]+\.(jpg|jpeg|png)$/;

export type Frame = { path: string; name: string };

function framesFor(slug: string): Frame[] {
  const base = agentPath(AGENT_DIRS.montage, slug);
  if (!fs.existsSync(base)) return [];
  const frames: Frame[] = [];
  for (const dir of fs.readdirSync(base).filter((name) => name.startsWith("frames"))) {
    for (const name of fs.readdirSync(path.join(base, dir)).sort()) {
      const relative = toAgentRelative(path.join(base, dir, name));
      if (FRAME_RE.test(relative)) frames.push({ path: relative, name });
    }
  }
  return frames.slice(0, 60);
}

/** Absolute path of a frame the client asked for, or null (the route serves nothing else from the project). */
export function resolveFrame(relative: string): { absolute: string; contentType: string } | null {
  if (!FRAME_RE.test(relative)) return null;
  const absolute = agentPath(relative);
  if (!fs.existsSync(absolute)) return null;
  return { absolute, contentType: relative.endsWith(".png") ? "image/png" : "image/jpeg" };
}

export type FilmingView = {
  card: Card;
  scriptApproved: boolean;
  shotlist: { file: string; header: string[]; rows: string[][]; raw: string; preTraining: boolean } | null;
  footage: { original: string; sizeBytes: number; info: VideoInfo | null } | null;
  montage: {
    file: string;
    parsed: ParsedMontage;
    status: string;
    preTraining: boolean;
    simulated: boolean;
    frames: Frame[];
  } | null;
  montageStyleTrained: boolean;
};

export async function getFilmingView(cardId: string): Promise<FilmingView> {
  const card = requireCard(cardId);

  let shotlist: FilmingView["shotlist"] = null;
  if (card.shotlistFile && outputExists(card.shotlistFile, "montage")) {
    const raw = readOutput(card.shotlistFile, "montage");
    const { fm, body } = splitFrontmatter(raw);
    const table = parseTable(body);
    shotlist = { file: card.shotlistFile, header: table?.header ?? [], rows: table?.rows ?? [], raw: body.trim(), preTraining: fm.pre_training === "true" };
  }

  let footage: FilmingView["footage"] = null;
  if (card.footageName) {
    const absolute = path.join(footageDir(card.id), card.footageName);
    if (fs.existsSync(absolute)) {
      footage = { original: card.footageOriginal ?? card.footageName, sizeBytes: fs.statSync(absolute).size, info: await probeVideo(absolute) };
    }
  }

  let montage: FilmingView["montage"] = null;
  if (card.montageFile && outputExists(card.montageFile, "montage")) {
    const parsed = parseMontage(readOutput(card.montageFile, "montage"));
    montage = {
      file: card.montageFile,
      parsed,
      status: parsed.header.status ?? "draft",
      preTraining: parsed.header.pre_training === "true",
      simulated: parsed.header.simulated === "true",
      frames: framesFor(card.slug),
    };
  }

  return { card, scriptApproved: scriptIsApproved(card), shotlist, footage, montage, montageStyleTrained: isTrained(readStyle("montage-style")) };
}
