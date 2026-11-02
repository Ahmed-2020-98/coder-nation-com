"use server";

import { redirect } from "next/navigation";
import { refresh } from "@/server/refresh";
import type { ActionState } from "@/lib/action-state";
import { formText } from "@/lib/action-state";
import {
  createContract,
  createTemplate,
  deleteTemplate,
  duplicateContract,
  parseContractInput,
  respondToContract,
  saveContract,
  saveTemplate,
  sendContract,
  templateInputSchema,
  withdrawContract,
} from "@/server/contracts";
import { clientFingerprint } from "@/server/request";
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

// ---------- templates (owner) ----------

export async function createTemplateAction(): Promise<void> {
  await requirePermission("contract.manage");
  redirect(`/contracts/templates/${await createTemplate()}`);
}

export async function saveTemplateAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "قالب غير صالح" };
  const parsed = templateInputSchema.safeParse(payload(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات القالب غير صالحة" };
  const saved = await saveTemplate(id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  refresh();
  return { ok: true, message: "اتحفظ القالب" };
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  await requirePermission("contract.manage");
  const id = formText(formData, "id");
  if (isId(id)) await deleteTemplate(id);
  redirect("/contracts/templates");
}

// ---------- contracts (owner) ----------

export async function createContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("contract.manage");
  const userId = formText(formData, "userId");
  const templateId = formText(formData, "templateId");
  if (!isId(userId)) return { error: "اختار الموظف" };
  const id = await createContract({ userId, templateId: isId(templateId) ? templateId : null }, user.id);
  if (!id) return { error: "الموظف أو القالب مش موجود" };
  redirect(`/contracts/${id}`);
}

export async function saveContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const parsed = parseContractInput(payload(formData));
  if (!parsed.ok) return { error: parsed.error };
  const saved = await saveContract(id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  refresh();
  return { ok: true, message: "اتحفظ العقد" };
}

export async function sendContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const result = await sendContract(id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتبعت العقد للموظف، هيلاقيه في حسابه" };
}

export async function withdrawContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contract.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "عقد غير صالح" };
  const result = await withdrawContract(id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتسحب العقد ورجع مسودة" };
}

export async function duplicateContractAction(formData: FormData): Promise<void> {
  const user = await requirePermission("contract.manage");
  const id = formText(formData, "id");
  const copy = isId(id) ? await duplicateContract(id, user.id) : null;
  redirect(copy ? `/contracts/${copy}` : "/contracts");
}

// ---------- the employee's answer ----------

export async function respondToContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("contract.respond");
  const id = formText(formData, "id");
  const answer = formText(formData, "answer");
  if (!isId(id) || (answer !== "accepted" && answer !== "declined")) return { error: "طلب غير صالح" };
  if (answer === "accepted" && formText(formData, "agree") !== "on") return { error: "علّم على «قرأت العقد وأوافق على كل بنوده» الأول" };
  const result = await respondToContract({ id, userId: user.id, answer, reason: formText(formData, "reason") }, await clientFingerprint());
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: answer === "accepted" ? "اتسجّلت موافقتك على العقد" : "اتسجّل رفضك للعقد" };
}
