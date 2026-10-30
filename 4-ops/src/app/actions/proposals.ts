"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formText } from "@/lib/action-state";
import { createProposalForDeal, duplicateProposal, markSent, parseProposalInput, saveProposal, setOutcome } from "@/server/proposals";
import { requirePermission } from "@/server/session";
import { getDeal } from "@/server/crm";

const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function createProposalAction(formData: FormData): Promise<void> {
  const user = await requirePermission("proposal.edit");
  const dealId = formText(formData, "dealId");
  if (!isId(dealId) || !(await getDeal(dealId))) redirect("/crm");
  const id = await createProposalForDeal(dealId, user.id);
  redirect(id ? `/proposals/${id}` : "/crm");
}

export async function duplicateProposalAction(formData: FormData): Promise<void> {
  const user = await requirePermission("proposal.edit");
  const id = formText(formData, "id");
  const copy = isId(id) ? await duplicateProposal(id, user.id) : null;
  redirect(copy ? `/proposals/${copy}` : "/proposals");
}

/** The editor sends its whole state as JSON in one field; it is validated and parsed here, never trusted. */
export async function saveProposalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("proposal.edit");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عرض غير صالح" };
  let raw: unknown;
  try {
    raw = JSON.parse(formText(formData, "payload"));
  } catch {
    return { error: "بيانات العرض غير صالحة" };
  }
  const parsed = parseProposalInput(raw);
  if (!parsed.ok) return { error: parsed.error };
  const saved = await saveProposal(id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  refresh();
  return { ok: true, message: "اتحفظ العرض" };
}

export async function markSentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("proposal.export");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عرض غير صالح" };
  const result = await markSent(id, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتسجّل إن العرض اتبعت واتنقلت الصفقة" };
}

export async function outcomeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("proposal.edit");
  const id = formText(formData, "id");
  const outcome = formText(formData, "outcome");
  if (!isId(id) || (outcome !== "accepted" && outcome !== "rejected")) return { error: "طلب غير صالح" };
  const result = await setOutcome(id, outcome, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}
