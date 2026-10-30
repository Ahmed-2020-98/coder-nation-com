import { createCard, getCardBySlug, listCards, listRuns, patchCard, type Card, type Run } from "../db";
import { parseIdeas } from "../parse/ideas";
import { isValidSlug, previousStage } from "@/lib/stages";
import { outputExists, readOutput, requireCard, ServiceError, updateOutputHeader } from "./common";

export type BoardCard = Card & {
  lastRun: Pick<Run, "id" | "kind" | "status" | "costUsd" | "startedAt" | "error"> | null;
};

/** Every card with its most recent run, for the Kanban board. */
export function getBoard(): BoardCard[] {
  const latest = new Map<string, Run>();
  for (const run of listRuns({ limit: 500 })) {
    if (run.cardId && !latest.has(run.cardId)) latest.set(run.cardId, run);
  }
  return listCards().map((card) => {
    const run = latest.get(card.id);
    return {
      ...card,
      lastRun: run
        ? { id: run.id, kind: run.kind, status: run.status, costUsd: run.costUsd, startedAt: run.startedAt, error: run.error }
        : null,
    };
  });
}

/**
 * "حوّل لفكرة": the user picked idea #N from an ideas file. This is the approval gate of the Research stage, so the
 * file's header records it (status: approved, selected_idea, slug), exactly as the terminal Orchestrator does.
 */
export function createCardFromIdea(input: { ideasFile: string; ideaNo: number; slug: string }): Card {
  if (!isValidSlug(input.slug)) {
    throw new ServiceError(400, "الـ slug لازم يكون حروف إنجليزي صغيرة وأرقام مفصولة بـ - (من 3 لـ 60 حرف)");
  }
  if (getCardBySlug(input.slug)) throw new ServiceError(409, "الـ slug ده مستخدم في كارت تاني");

  const parsed = parseIdeas(readOutput(input.ideasFile, "ideas"));
  const idea = parsed.ideas.find((candidate) => candidate.no === input.ideaNo);
  if (!idea) throw new ServiceError(404, "الفكرة دي مش موجودة في الملف");

  const card = createCard({
    slug: input.slug,
    title: idea.title,
    ideaFile: input.ideasFile,
    ideaNo: idea.no,
    ideaQuestion: idea.question || idea.title,
    ideaHook: idea.hook || null,
  });
  updateOutputHeader(input.ideasFile, "ideas", {
    status: "approved",
    selected_idea: String(idea.no),
    slug: input.slug,
  });
  return card;
}

/** Explicit step back. File headers go back to awaiting_approval so the files and the board never disagree. */
export function rollbackCard(id: string): Card {
  const card = requireCard(id);
  const target = previousStage(card.stage);
  if (!target) throw new ServiceError(409, "الكارت في أول مرحلة");

  if (card.stage === "filming" && outputExists(card.scriptFile, "scripts")) {
    updateOutputHeader(card.scriptFile!, "scripts", { status: "awaiting_approval" });
  }
  if (card.stage === "ready" && outputExists(card.postFile, "posts")) {
    updateOutputHeader(card.postFile!, "posts", { status: "awaiting_approval" });
  }
  return patchCard(id, card.stage === "published" ? { stage: target, publishedAt: null, publishedUrl: null } : { stage: target });
}
