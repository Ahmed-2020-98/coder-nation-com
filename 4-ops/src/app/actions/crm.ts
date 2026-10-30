"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { formText, type ActionState } from "@/lib/action-state";
import { ACTIVITY_KINDS, CURRENCIES, EMAIL_RE, PHONE_RE, SERVICES, STAGES, normalizePhone, type Currency, type Stage } from "@/lib/crm-rules";
import { parseMoney } from "@/lib/money";
import { addActivity, addContact, addFollowUp, assignDeal, completeFollowUp, createClient, createDeal, dealIdOfFollowUp, getDeal, moveDeal, updateClient, updateDealDetails } from "@/server/crm";
import { canAccessDeal } from "@/server/permissions";
import { requirePermission } from "@/server/session";
import { sql } from "@/server/db";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));
const phone = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : normalizePhone(v)))
  .refine((v) => v === null || PHONE_RE.test(v), "رقم هاتف غير صحيح");
const email = optionalText(254).refine((v) => v === null || EMAIL_RE.test(v), "إيميل غير صحيح");

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

/** Loads a deal and applies the "employees only see their own" rule; anything else bounces back to the board. */
async function dealForUser(user: { id: string; role: "owner" | "manager" | "employee" }, id: string) {
  const deal = await getDeal(id);
  if (!deal || !canAccessDeal(user, deal)) redirect("/crm");
  return deal;
}

function moneyAndCurrency(valueText: string, currencyText: string): { valueMinor: number | null; currency: Currency | null } | { error: string } {
  if (valueText.trim() === "") return { valueMinor: null, currency: null };
  const valueMinor = parseMoney(valueText);
  if (valueMinor === null) return { error: "القيمة المتوقعة غير صالحة" };
  if (!(CURRENCIES as readonly string[]).includes(currencyText)) return { error: "اختار العملة" };
  return { valueMinor, currency: currencyText as Currency };
}

const dealSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان الصفقة").max(200),
  service: z.string().trim().refine((v) => v === "" || (SERVICES as readonly string[]).includes(v), "نوع مشروع غير صالح").transform((v) => (v === "" ? null : v)),
  message: optionalText(2000),
  ownerId: z.union([uuid, z.literal("")]).transform((v) => (v === "" ? null : v)),
});

export async function createDealAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.create");
  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const money = moneyAndCurrency(formText(formData, "value"), formText(formData, "currency"));
  if ("error" in money) return { fieldErrors: { value: money.error } };

  const existingClientId = formText(formData, "clientId");
  let clientInput: { clientId?: string; client?: { name: string; phone: string | null; email: string | null } };
  if (existingClientId) {
    if (!uuid.safeParse(existingClientId).success) return { error: "عميل غير صالح" };
    clientInput = { clientId: existingClientId };
  } else {
    const client = z.object({ clientName: z.string().trim().min(2, "اكتب اسم العميل").max(160), clientPhone: phone, clientEmail: email }).safeParse(Object.fromEntries(formData));
    if (!client.success) return { fieldErrors: fieldErrors(client.error) };
    clientInput = { client: { name: client.data.clientName, phone: client.data.clientPhone, email: client.data.clientEmail } };
  }
  const { id } = await createDeal({ ...parsed.data, ...money, ...clientInput, source: "manual" }, user.id);
  redirect(`/crm/deals/${id}`);
}

export async function moveDealAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.move");
  const id = formText(formData, "id");
  const to = formText(formData, "stage");
  if (!uuid.safeParse(id).success || !(STAGES as readonly string[]).includes(to)) return { error: "طلب غير صالح" };
  await dealForUser(user, id);
  const result = await moveDeal(id, to as Stage, formText(formData, "lostReason") || null, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

export async function assignDealAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.assign");
  const id = formText(formData, "id");
  const ownerId = formText(formData, "ownerId");
  if (!uuid.safeParse(id).success || (ownerId !== "" && !uuid.safeParse(ownerId).success)) return { error: "طلب غير صالح" };
  if (ownerId) {
    const [owner] = await sql()<{ id: string }[]>`select id from users where id = ${ownerId} and active`;
    if (!owner) return { error: "المستخدم ده مش موجود أو موقوف" };
  }
  if (!(await assignDeal(id, ownerId || null, user.id))) return { error: "الصفقة مش موجودة" };
  refresh();
  return { ok: true };
}

export async function updateDealAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.edit");
  const id = formText(formData, "id");
  await dealForUser(user, id);
  const parsed = dealSchema.pick({ title: true, service: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const money = moneyAndCurrency(formText(formData, "value"), formText(formData, "currency"));
  if ("error" in money) return { fieldErrors: { value: money.error } };
  await updateDealDetails(id, { ...parsed.data, ...money });
  refresh();
  return { ok: true };
}

export async function addActivityAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.log_activity");
  const id = formText(formData, "id");
  await dealForUser(user, id);
  const kind = formText(formData, "kind");
  const body = formText(formData, "body").trim();
  if (!(ACTIVITY_KINDS as readonly string[]).includes(kind)) return { error: "نوع نشاط غير صالح" };
  if (body.length < 1 || body.length > 4000) return { fieldErrors: { body: "اكتب نص النشاط (حتى 4000 حرف)" } };
  await addActivity(id, user.id, kind as (typeof ACTIVITY_KINDS)[number], body);
  refresh();
  return { ok: true };
}

export async function addFollowUpAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("deal.log_activity");
  const id = formText(formData, "id");
  const deal = await dealForUser(user, id);
  const due = new Date(formText(formData, "dueAt"));
  const note = formText(formData, "note").trim().slice(0, 500);
  if (Number.isNaN(due.getTime())) return { fieldErrors: { dueAt: "اختار موعد المتابعة" } };
  await addFollowUp(id, deal.ownerId ?? user.id, due, note);
  refresh();
  return { ok: true };
}

export async function completeFollowUpAction(formData: FormData): Promise<void> {
  const user = await requirePermission("deal.log_activity");
  const followUpId = formText(formData, "id");
  const dealId = await dealIdOfFollowUp(followUpId);
  if (!dealId) return;
  await dealForUser(user, dealId);
  await completeFollowUp(followUpId);
  refresh();
}

const clientSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم العميل").max(160),
  phone,
  email,
  website: optionalText(200),
  notes: z.string().trim().max(4000),
});

export async function saveClientAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("client.manage");
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const id = formText(formData, "id");
  if (id) {
    if (!uuid.safeParse(id).success || !(await updateClient(id, parsed.data))) return { error: "العميل مش موجود" };
    refresh();
    return { ok: true };
  }
  redirect(`/crm/clients/${await createClient(parsed.data, user.id)}`);
}

export async function addContactAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("client.manage");
  const clientId = formText(formData, "clientId");
  const parsed = z.object({ name: z.string().trim().min(2, "اكتب اسم جهة الاتصال").max(120), jobTitle: optionalText(120), phone, email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || !uuid.safeParse(clientId).success) return { fieldErrors: parsed.success ? {} : fieldErrors(parsed.error), error: parsed.success ? "عميل غير صالح" : undefined };
  await addContact(clientId, parsed.data);
  refresh();
  return { ok: true };
}

