import { todayISO } from "../paths";
import { parsePost, serializePost, type PostParts } from "../parse/post";
import { parseMontage } from "../parse/montage";
import { parseScript } from "../parse/script";
import { postingJob } from "../agents/prompts";
import { startRun } from "../jobs";
import { listCards, patchCard, type Card, type Run } from "../db";
import { isTrained, readStyle } from "../files/style";
import { outputExists, readOutput, requireCard, requireStage, ServiceError, updateOutputHeader, writeOutput } from "./common";

/** Control characters out, length capped: the path only ever appears as text in a prompt and in the file header. */
function cleanPath(value: string | null | undefined): string | null {
  const cleaned = (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
  return cleaned || null;
}

export function startPosting(cardId: string, finalVideoPath: string | null): Run {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "تجهيز البوست بيتم بعد اعتماد خطة المونتاج");
  if (!card.scriptFile || !outputExists(card.scriptFile, "scripts")) throw new ServiceError(409, "لا يوجد سكريبت معتمد");
  if (!card.montageFile || !outputExists(card.montageFile, "montage")) throw new ServiceError(409, "اعمل خطة المونتاج الأول");
  if (parseMontage(readOutput(card.montageFile, "montage")).header.status !== "approved") {
    throw new ServiceError(409, "اعتمد خطة المونتاج الأول");
  }
  const video = cleanPath(finalVideoPath) ?? card.finalVideoPath;
  if (video !== card.finalVideoPath) patchCard(card.id, { finalVideoPath: video });
  return startRun({
    cardId: card.id,
    label: `${card.slug} (بوست)`,
    job: postingJob({ scriptFile: card.scriptFile, montageFile: card.montageFile, finalVideoPath: video, slug: card.slug, date: todayISO() }),
    onSuccess: ({ outputFile }) => {
      if (!outputFile) throw new Error("لا يوجد ملف بوست");
      patchCard(card.id, { postFile: outputFile });
    },
  });
}

export type PostingView = {
  card: Card;
  post: {
    file: string;
    title: string;
    status: string;
    preTraining: boolean;
    simulated: boolean;
    parts: PostParts;
    statusText: string;
    editable: boolean;
  } | null;
  scriptTrained: boolean;
};

export function getPostingView(cardId: string): PostingView {
  const card = requireCard(cardId);
  const scriptTrained = isTrained(readStyle("script-style"));
  if (!card.postFile || !outputExists(card.postFile, "posts")) return { card, post: null, scriptTrained };
  const parsed = parsePost(readOutput(card.postFile, "posts"));
  return {
    card,
    scriptTrained,
    post: {
      file: card.postFile,
      title: parsed.title,
      status: parsed.header.status ?? "draft",
      preTraining: parsed.header.pre_training === "true",
      simulated: parsed.header.simulated === "true",
      parts: parsed.parts,
      statusText: parsed.statusText,
      editable: card.stage === "filming" || card.stage === "ready",
    },
  };
}

export function savePost(cardId: string, parts: PostParts): PostingView {
  const card = requireCard(cardId);
  requireStage(card, ["filming", "ready"], "البوست اتنشر أو لسه مجهّزش");
  if (!card.postFile) throw new ServiceError(409, "لا يوجد بوست");
  writeOutput(card.postFile, "posts", serializePost(readOutput(card.postFile, "posts"), parts));
  // An approved post that was edited needs approving again.
  if (card.stage === "ready") {
    updateOutputHeader(card.postFile, "posts", { status: "awaiting_approval" });
    patchCard(card.id, { stage: "filming" });
  }
  return getPostingView(cardId);
}

export function setSchedule(cardId: string, iso: string | null): Card {
  const card = requireCard(cardId);
  if (iso !== null && Number.isNaN(Date.parse(iso))) throw new ServiceError(400, "تاريخ غير صالح");
  return patchCard(card.id, { scheduledAt: iso });
}

/** "جاهز للنشر": marks the card. Nothing is published, and no code in this project can publish. */
export function markReady(cardId: string): Card {
  const card = requireCard(cardId);
  requireStage(card, ["filming"], "الكارت مش في مرحلة التجهيز");
  if (!card.postFile || !outputExists(card.postFile, "posts")) throw new ServiceError(409, "جهّز البوست الأول");
  const parsed = parsePost(readOutput(card.postFile, "posts"));
  if (!parsed.parts.caption.trim()) throw new ServiceError(400, "الكابشن فاضي");
  updateOutputHeader(card.postFile, "posts", { status: "approved" });
  return patchCard(card.id, { stage: "ready" });
}

/** Manual: the user published it by hand and records it here (optionally with the link). */
export function markPublished(cardId: string, url: string | null): Card {
  const card = requireCard(cardId);
  requireStage(card, ["ready"], "علّم الكارت «جاهز للنشر» الأول");
  let cleanUrl: string | null = null;
  if (url && url.trim()) {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
      cleanUrl = parsed.toString();
    } catch {
      throw new ServiceError(400, "الرابط غير صالح");
    }
  }
  return patchCard(card.id, { stage: "published", publishedAt: new Date().toISOString(), publishedUrl: cleanUrl });
}

export type CalendarItem = { id: string; slug: string; title: string; stage: Card["stage"]; scheduledAt: string | null };

/** Every card that already has a post (schedulable) plus anything scheduled. */
export function getCalendar(): { scheduled: CalendarItem[]; unscheduled: CalendarItem[] } {
  const items = listCards()
    .filter((card) => card.scheduledAt || card.postFile)
    .map((card) => ({ id: card.id, slug: card.slug, title: card.title, stage: card.stage, scheduledAt: card.scheduledAt }));
  return {
    scheduled: items.filter((item) => item.scheduledAt).sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))),
    unscheduled: items.filter((item) => !item.scheduledAt && item.stage !== "published"),
  };
}

// The script status is read for the board's "pre-training" hint; exported so pages don't re-parse files themselves.
export function scriptStatus(card: Card): string | null {
  if (!card.scriptFile || !outputExists(card.scriptFile, "scripts")) return null;
  return parseScript(readOutput(card.scriptFile, "scripts")).header.status ?? null;
}
