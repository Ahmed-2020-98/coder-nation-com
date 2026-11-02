import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PAYMENT_METHODS, takesPayments, type ClientContractStatus, type InvoiceStatus, type PaymentMethod } from "@/lib/client-contract-rules";
import type { Currency } from "@/lib/crm-rules";
import { isIsoDate, todayInCairo } from "@/lib/dates";
import { formatMoney, parseMoney } from "@/lib/money";
import { sql } from "./db";
import { fromJson } from "./sql";

type Tx = ReturnType<typeof sql>;
const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** One payment the client sent, and the invoice printed for it. */
export type Invoice = {
  id: string;
  number: string;
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  clientName: string;
  dealId: string;
  milestoneIndex: number | null;
  milestoneTitle: string | null;
  amountMinor: number;
  currency: Currency;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  note: string;
  status: InvoiceStatus;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
};

type InvoiceRow = {
  id: string;
  number: string;
  contract_id: string;
  contract_number: string;
  contract_title: string;
  client_name: string;
  deal_id: string;
  milestones: { title: string }[];
  milestone_index: number | null;
  amount_minor: string;
  currency: string;
  paid_on: string;
  method: PaymentMethod;
  reference: string;
  note: string;
  status: InvoiceStatus;
  void_reason: string | null;
  voided_at: Date | null;
  created_at: Date;
};

const SELECT = `i.id, i.number, i.contract_id, k.number as contract_number, k.title as contract_title, k.client_name, k.deal_id, k.milestones,
  i.milestone_index, i.amount_minor, i.currency, date_format(i.paid_on, '%Y-%m-%d') as paid_on, i.method, i.reference, i.note, i.status,
  i.void_reason, i.voided_at, i.created_at`;

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  number: r.number,
  contractId: r.contract_id,
  contractNumber: r.contract_number,
  contractTitle: r.contract_title,
  clientName: r.client_name,
  dealId: r.deal_id,
  milestoneIndex: r.milestone_index,
  milestoneTitle: r.milestone_index === null ? null : (fromJson<{ title: string }[]>(r.milestones)[r.milestone_index]?.title ?? null),
  amountMinor: Number(r.amount_minor),
  currency: r.currency.trim() as Currency,
  paidOn: r.paid_on,
  method: r.method,
  reference: r.reference,
  note: r.note,
  status: r.status,
  voidReason: r.void_reason,
  voidedAt: r.voided_at,
  createdAt: r.created_at,
});

/** Invoices, newest payment first: all of them, one contract's, or those paid within [from, to] (inclusive days). */
export async function listInvoices(filter: { contractId?: string; from?: string; to?: string } = {}): Promise<Invoice[]> {
  const db = sql();
  const rows = await db<InvoiceRow[]>`
    select ${db.unsafe(SELECT)} from invoices i join client_contracts k on k.id = i.contract_id
    where 1 = 1
      ${filter.contractId ? db`and i.contract_id = ${filter.contractId}` : db``}
      ${filter.from ? db`and i.paid_on >= ${filter.from}` : db``}
      ${filter.to ? db`and i.paid_on <= ${filter.to}` : db``}
    order by i.paid_on desc, i.created_at desc limit 500`;
  return rows.map(toInvoice);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (!isId(id)) return null;
  const db = sql();
  const [row] = await db<InvoiceRow[]>`select ${db.unsafe(SELECT)} from invoices i join client_contracts k on k.id = i.contract_id where i.id = ${id}`;
  return row ? toInvoice(row) : null;
}

/**
 * What the contract had collected the moment this invoice was issued (it included): the invoices recorded up to it
 * that were live then. Printed again later, an invoice shows the same figures it was issued with.
 */
export async function paidThrough(invoiceId: string): Promise<number> {
  const [row] = await sql()<{ paid: string }[]>`
    select coalesce(sum(i.amount_minor), 0) as paid
    from invoices i join invoices me on me.id = ${invoiceId}
    where i.contract_id = me.contract_id and i.created_at <= me.created_at
      and (i.id = me.id or i.status = 'issued' or i.voided_at > me.created_at)`;
  return Number(row.paid);
}

/** INV-2026-0001: one atomic counter row per year, never reused (a voided invoice keeps its number). */
async function nextNumber(tx: Tx, year: number): Promise<string> {
  await tx`insert into invoice_counters (year, last_number) values (${year}, 1) on duplicate key update last_number = last_number + 1`;
  const [row] = await tx<{ last_number: number }[]>`select last_number from invoice_counters where year = ${year}`;
  return `INV-${year}-${String(row.last_number).padStart(4, "0")}`;
}

export const paymentInputSchema = z.object({
  amount: z.string().trim().min(1, "اكتب المبلغ اللي وصل").max(20),
  paidOn: z.string().trim().refine(isIsoDate, "تاريخ الدفع غير صالح"),
  method: z.enum(PAYMENT_METHODS, { message: "اختار طريقة الدفع" }),
  reference: z.string().trim().max(120),
  note: z.string().trim().max(500),
  milestoneIndex: z.string().trim().max(3),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

export type PaymentResult = { ok: true; id: string; number: string } | { ok: false; error: string };

/**
 * Records money the client sent and issues its invoice. The contract row is locked while the total collected is
 * checked, so two payments recorded at once can never take it past the contract's total.
 */
export async function recordPayment(contractId: string, raw: Record<keyof PaymentInput, string>, userId: string): Promise<PaymentResult> {
  const parsed = paymentInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات الدفعة غير صالحة" };
  const v = parsed.data;
  const amount = parseMoney(v.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "المبلغ غير صالح (أرقام فقط، حتى خانتين عشريتين)" };
  if (v.paidOn > todayInCairo()) return { ok: false, error: "تاريخ الدفع في المستقبل" };
  const milestoneIndex = v.milestoneIndex === "" ? null : Number(v.milestoneIndex);
  if (milestoneIndex !== null && !(Number.isInteger(milestoneIndex) && milestoneIndex >= 0)) return { ok: false, error: "الدفعة المختارة غير صالحة" };

  return sql().begin(async (tx): Promise<PaymentResult> => {
    const [contract] = await tx<{ status: ClientContractStatus; total_minor: string; currency: string; milestones: unknown; deal_id: string; number: string }[]>`
      select status, total_minor, currency, milestones, deal_id, number from client_contracts where id = ${contractId} for update`;
    if (!contract) return { ok: false, error: "العقد مش موجود" };
    if (!takesPayments(contract.status)) return { ok: false, error: "الدفعات بتتسجّل على عقد «جاهز للتوقيع» أو «موقّع» بس" };
    if (milestoneIndex !== null && milestoneIndex >= fromJson<unknown[]>(contract.milestones).length) return { ok: false, error: "الدفعة المختارة غير صالحة" };
    const [paid] = await tx<{ paid: string }[]>`select coalesce(sum(amount_minor), 0) as paid from invoices where contract_id = ${contractId} and status = 'issued'`;
    const currency = contract.currency.trim() as Currency;
    const remaining = Number(contract.total_minor) - Number(paid.paid);
    if (remaining <= 0) return { ok: false, error: "العقد اتدفع بالكامل" };
    if (amount > remaining) return { ok: false, error: `المبلغ أكبر من المتبقي على العقد (${formatMoney(remaining, currency)})` };
    const id = randomUUID();
    const number = await nextNumber(tx as unknown as Tx, new Date().getFullYear());
    await tx`
      insert into invoices (id, number, contract_id, milestone_index, amount_minor, currency, paid_on, method, reference, note, created_by)
      values (${id}, ${number}, ${contractId}, ${milestoneIndex}, ${amount}, ${currency}, ${v.paidOn}, ${v.method}, ${v.reference}, ${v.note}, ${userId})`;
    await tx`
      insert into activities (id, deal_id, user_id, kind, body)
      values (${randomUUID()}, ${contract.deal_id}, ${userId}, 'system', ${`اتسجّلت دفعة ${formatMoney(amount, currency)} على العقد ${contract.number}، فاتورة ${number}`})`;
    return { ok: true, id, number };
  });
}

/** Voids an issued invoice (a payment recorded by mistake). Nothing is deleted: the number stays taken and the reason is kept. */
export async function voidInvoice(id: string, reason: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const why = reason.trim();
  if (why.length < 2 || why.length > 300) return { ok: false, error: "اكتب سبب الإلغاء" };
  return sql().begin(async (tx) => {
    const [row] = await tx<{ status: InvoiceStatus; number: string; deal_id: string }[]>`
      select i.status, i.number, k.deal_id from invoices i join client_contracts k on k.id = i.contract_id where i.id = ${id} for update`;
    if (!row) return { ok: false as const, error: "الفاتورة مش موجودة" };
    if (row.status === "void") return { ok: false as const, error: "الفاتورة ملغاة بالفعل" };
    await tx`update invoices set status = 'void', void_reason = ${why}, voided_at = now(3), voided_by = ${userId} where id = ${id}`;
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${row.deal_id}, ${userId}, 'system', ${`اتلغت الفاتورة ${row.number}: ${why}`})`;
    return { ok: true as const };
  });
}
