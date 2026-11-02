"use server";

import { redirect } from "next/navigation";
import { refresh } from "@/server/refresh";
import type { ActionState } from "@/lib/action-state";
import { formText } from "@/lib/action-state";
import {
  cancelClientContract,
  clientContractBackToDraft,
  clientTemplateInputSchema,
  createClientContract,
  createClientTemplate,
  deleteClientTemplate,
  markClientContractReady,
  markClientContractSigned,
  parseClientContractInput,
  saveClientContract,
  saveClientTemplate,
  signInputSchema,
} from "@/server/client-contracts";
import { recordPayment, voidInvoice } from "@/server/invoices";
import { requirePermission } from "@/server/session";

const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** The editors send their whole state as JSON in one field; it is validated here, never trusted. */
function payload(formData: FormData): unknown {
  try {
    return JSON.parse(formText(formData, "payload"));
  } catch {
    return null;
  }
}

// ---------- templates ----------

export async function createClientTemplateAction(): Promise<void> {
  await requirePermission("client_contract.manage");
  redirect(`/client-contracts/templates/${await createClientTemplate()}`);
}

export async function saveClientTemplateAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "قالب غير صالح" };
  const parsed = clientTemplateInputSchema.safeParse(payload(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات القالب غير صالحة" };
  const saved = await saveClientTemplate(id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  refresh();
  return { ok: true, message: "اتحفظ القالب" };
}

export async function deleteClientTemplateAction(formData: FormData): Promise<void> {
  await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (isId(id)) await deleteClientTemplate(id);
  redirect("/client-contracts/templates");
}

// ---------- contracts ----------

export async function createClientContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("client_contract.manage");
  const proposalId = formText(formData, "proposalId");
  const templateId = formText(formData, "templateId");
  if (!isId(proposalId)) return { error: "عرض غير صالح" };
  const result = await createClientContract({ proposalId, templateId: isId(templateId) ? templateId : null }, user.id);
  if (!result.ok) return { error: result.error };
  redirect(`/client-contracts/${result.id}`);
}

export async function saveClientContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const parsed = parseClientContractInput(payload(formData));
  if (!parsed.ok) return { error: parsed.error };
  const saved = await saveClientContract(id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  refresh();
  return { ok: true, message: "اتحفظ العقد" };
}

export async function markClientContractReadyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const result = await markClientContractReady(id, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "العقد جاهز. نزّل الـ PDF واطبعه للتوقيع." };
}

export async function clientContractBackToDraftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const result = await clientContractBackToDraft(id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "العقد رجع مسودة" };
}

export async function markClientContractSignedAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const parsed = signInputSchema.safeParse({ signedOn: formText(formData, "signedOn"), signedByName: formText(formData, "signedByName") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات التوقيع غير صالحة" };
  const result = await markClientContractSigned(id, parsed.data, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتسجّل توقيع العقد" };
}

export async function cancelClientContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("client_contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const result = await cancelClientContract(id, formText(formData, "reason"), user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتلغى العقد" };
}

// ---------- payments and invoices ----------

export async function recordPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoice.issue");
  const contractId = formText(formData, "contractId");
  if (!isId(contractId)) return { error: "عقد غير صالح" };
  const result = await recordPayment(
    contractId,
    {
      amount: formText(formData, "amount"),
      paidOn: formText(formData, "paidOn"),
      method: formText(formData, "method"),
      reference: formText(formData, "reference"),
      note: formText(formData, "note"),
      milestoneIndex: formText(formData, "milestoneIndex"),
    },
    user.id,
  );
  if (!result.ok) return { error: result.error };
  redirect(`/invoices/${result.id}`);
}

export async function voidInvoiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoice.void");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "فاتورة غير صالحة" };
  const result = await voidInvoice(id, formText(formData, "reason"), user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتلغت الفاتورة" };
}
