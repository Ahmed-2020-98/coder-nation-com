import { isOpenStage, type Stage } from "./crm-rules";

export type Transition = { ok: true } | { ok: false; error: string };

/**
 * Stage changes, in one place. Open stages move freely; won/lost close the deal (lost needs a reason); a closed deal
 * can only be reopened into an open stage, and a stage can't be "moved" to itself.
 */
export function validateTransition(from: Stage, to: Stage, lostReason: string | null | undefined): Transition {
  if (from === to) return { ok: false, error: "الصفقة في المرحلة دي بالفعل" };
  if (to === "lost") {
    const reason = lostReason?.trim() ?? "";
    if (reason.length < 2) return { ok: false, error: "اكتب سبب الخسارة" };
    if (reason.length > 300) return { ok: false, error: "سبب الخسارة أطول من 300 حرف" };
  }
  if (!isOpenStage(from) && !isOpenStage(to)) return { ok: false, error: "افتح الصفقة الأول (ارجعها لمرحلة مفتوحة) قبل ما تغيّر نتيجتها" };
  return { ok: true };
}
