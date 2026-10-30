import { computeTotals, milestonesAreComplete } from "./money";

export type ProposalDraft = {
  items: { title: string; quantity: number; unitPriceMinor: number }[];
  milestones: { title: string; percentBp: number }[];
  discountMinor: number;
  taxRateBp: number | null;
  intro: string;
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
};

/** `[يحدده الفريق: ...]`-style gaps left in the template text. They are fine in a draft and embarrassing in a PDF. */
export const PLACEHOLDER_RE = /\[[^\]\n]{2,}\]/g;

export function countPlaceholders(draft: Pick<ProposalDraft, "intro" | "sections" | "timeline">): number {
  const texts = [draft.intro, ...draft.sections.flatMap((s) => [s.title, s.body]), ...draft.timeline.map((t) => t.title)];
  return texts.reduce((n, text) => n + (text.match(PLACEHOLDER_RE)?.length ?? 0), 0);
}

/** What stops a proposal from being exported / marked as sent. Empty list = ready. */
export function blockingProblems(draft: ProposalDraft): string[] {
  const problems: string[] = [];
  if (draft.items.length === 0) problems.push("ضيف بند واحد على الأقل في العرض المالي");
  const totals = computeTotals(draft.items, draft.discountMinor, draft.taxRateBp);
  if (draft.items.length > 0 && totals.totalMinor <= 0) problems.push("إجمالي العرض لازم يكون أكبر من صفر");
  if (draft.discountMinor > totals.subtotalMinor) problems.push("الخصم أكبر من إجمالي البنود");
  if (!milestonesAreComplete(draft.milestones.map((m) => m.percentBp))) problems.push("نسب الدفعات لازم يبقى مجموعها 100%");
  return problems;
}
