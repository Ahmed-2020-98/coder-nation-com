import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { clientContractProblems, type ClientContractStatus } from "@/lib/client-contract-rules";
import type { Clause } from "@/lib/contract-rules";
import { EMAIL_RE, PHONE_RE, normalizePhone, type Currency } from "@/lib/crm-rules";
import { isIsoDate, todayInCairo } from "@/lib/dates";
import { computeTotals, splitPayments } from "@/lib/money";
import { getCompany } from "./company";
import { getDeal } from "./crm";
import { sql } from "./db";
import { getProposal, type ProposalItem } from "./proposals";
import { fromJson } from "./sql";

type Result = { ok: true } | { ok: false; error: string };
type Tx = ReturnType<typeof sql>;
const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

const logActivity = (tx: Tx, dealId: string, userId: string, body: string) =>
  tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${dealId}, ${userId}, 'system', ${body})`;

// ---------- templates ----------

export type ClientContractTemplate = { id: string; title: string; clauses: Clause[]; updatedAt: Date };

type TemplateRow = { id: string; title: string; clauses: Clause[]; updated_at: Date };
const toTemplate = (r: TemplateRow): ClientContractTemplate => ({ id: r.id, title: r.title, clauses: fromJson(r.clauses), updatedAt: r.updated_at });

/** Oldest first: the first one is the default for a new contract. */
export async function listClientTemplates(): Promise<ClientContractTemplate[]> {
  const rows = await sql()<TemplateRow[]>`select id, title, clauses, updated_at from client_contract_templates order by created_at, title`;
  return rows.map(toTemplate);
}

export async function getClientTemplate(id: string): Promise<ClientContractTemplate | null> {
  if (!isId(id)) return null;
  const [row] = await sql()<TemplateRow[]>`select id, title, clauses, updated_at from client_contract_templates where id = ${id}`;
  return row ? toTemplate(row) : null;
}

const clausesSchema = z.array(z.object({ title: z.string().trim().min(1, "كل بند لازم يبقى له عنوان").max(120), body: z.string().trim().max(6000) })).max(40, "أقصى عدد 40 بند");

export const clientTemplateInputSchema = z.object({ title: z.string().trim().min(2, "اكتب اسم القالب").max(200), clauses: clausesSchema });
export type ClientTemplateInput = z.infer<typeof clientTemplateInputSchema>;

export async function createClientTemplate(): Promise<string> {
  const id = randomUUID();
  await sql()`insert into client_contract_templates (id, title, clauses) values (${id}, 'قالب جديد', ${sql().json([])})`;
  return id;
}

export async function saveClientTemplate(id: string, input: ClientTemplateInput): Promise<Result> {
  const result = await sql()`update client_contract_templates set title = ${input.title}, clauses = ${sql().json(input.clauses)}, updated_at = now(3) where id = ${id}`;
  return result.count > 0 ? { ok: true } : { ok: false, error: "القالب مش موجود" };
}

/** Contracts keep their own copy of the clauses, so deleting a template never changes a contract. */
export async function deleteClientTemplate(id: string): Promise<boolean> {
  const result = await sql()`delete from client_contract_templates where id = ${id}`;
  return result.count > 0;
}

// ---------- contracts ----------

export type ContractMilestone = { title: string; percentBp: number; amountMinor: number };

export type ClientContract = {
  id: string;
  number: string;
  proposalId: string;
  proposalNumber: string;
  dealId: string;
  clientId: string;
  templateId: string | null;
  status: ClientContractStatus;
  title: string;
  clientName: string;
  clientRepresentative: string;
  clientIdNumber: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  startDate: string | null;
  currency: Currency;
  items: ProposalItem[];
  discountMinor: number;
  taxRateBp: number | null;
  totalMinor: number;
  milestones: ContractMilestone[];
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
  clauses: Clause[];
  readyAt: Date | null;
  signedOn: string | null;
  signedByName: string;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ContractRow = {
  id: string;
  number: string;
  proposal_id: string;
  proposal_number: string;
  deal_id: string;
  client_id: string;
  template_id: string | null;
  status: ClientContractStatus;
  title: string;
  client_name: string;
  client_representative: string;
  client_id_number: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  start_date: string | null;
  currency: string;
  items: ProposalItem[];
  discount_minor: string;
  tax_rate_bp: number | null;
  total_minor: string;
  milestones: ContractMilestone[];
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
  clauses: Clause[];
  ready_at: Date | null;
  signed_on: string | null;
  signed_by_name: string;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
  paid_minor?: string;
};

const SELECT = `k.id, k.number, k.proposal_id, p.number as proposal_number, k.deal_id, k.client_id, k.template_id, k.status, k.title,
  k.client_name, k.client_representative, k.client_id_number, k.client_address, k.client_phone, k.client_email,
  date_format(k.start_date, '%Y-%m-%d') as start_date, k.currency, k.items, k.discount_minor, k.tax_rate_bp, k.total_minor,
  k.milestones, k.sections, k.timeline, k.clauses, k.ready_at, date_format(k.signed_on, '%Y-%m-%d') as signed_on, k.signed_by_name,
  k.cancel_reason, k.created_at, k.updated_at`;

const PAID = `coalesce((select sum(i.amount_minor) from invoices i where i.contract_id = k.id and i.status = 'issued'), 0) as paid_minor`;

const toContract = (r: ContractRow): ClientContract => ({
  id: r.id,
  number: r.number,
  proposalId: r.proposal_id,
  proposalNumber: r.proposal_number,
  dealId: r.deal_id,
  clientId: r.client_id,
  templateId: r.template_id,
  status: r.status,
  title: r.title,
  clientName: r.client_name,
  clientRepresentative: r.client_representative,
  clientIdNumber: r.client_id_number,
  clientAddress: r.client_address,
  clientPhone: r.client_phone,
  clientEmail: r.client_email,
  startDate: r.start_date,
  currency: r.currency.trim() as Currency,
  items: fromJson(r.items),
  discountMinor: Number(r.discount_minor),
  taxRateBp: r.tax_rate_bp,
  totalMinor: Number(r.total_minor),
  milestones: fromJson(r.milestones),
  sections: fromJson(r.sections),
  timeline: fromJson(r.timeline),
  clauses: fromJson(r.clauses),
  readyAt: r.ready_at,
  signedOn: r.signed_on,
  signedByName: r.signed_by_name,
  cancelReason: r.cancel_reason,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ClientContractSummary = Pick<ClientContract, "id" | "number" | "proposalNumber" | "dealId" | "status" | "title" | "clientName" | "currency" | "totalMinor" | "signedOn" | "createdAt"> & { paidMinor: number };

/** Every contract, or a deal's contracts, newest first, with what has been collected on each. */
export async function listClientContracts(filter: { dealId?: string; proposalId?: string } = {}): Promise<ClientContractSummary[]> {
  const db = sql();
  const rows = await db<ContractRow[]>`
    select ${db.unsafe(SELECT)}, ${db.unsafe(PAID)} from client_contracts k join proposals p on p.id = k.proposal_id
    where 1 = 1 ${filter.dealId ? db`and k.deal_id = ${filter.dealId}` : db``} ${filter.proposalId ? db`and k.proposal_id = ${filter.proposalId}` : db``}
    order by k.created_at desc limit 300`;
  return rows.map((r) => {
    const c = toContract(r);
    return {
      id: c.id,
      number: c.number,
      proposalNumber: c.proposalNumber,
      dealId: c.dealId,
      status: c.status,
      title: c.title,
      clientName: c.clientName,
      currency: c.currency,
      totalMinor: c.totalMinor,
      signedOn: c.signedOn,
      createdAt: c.createdAt,
      paidMinor: Number(r.paid_minor ?? 0),
    };
  });
}

export async function getClientContract(id: string): Promise<ClientContract | null> {
  if (!isId(id)) return null;
  const db = sql();
  const [row] = await db<ContractRow[]>`select ${db.unsafe(SELECT)} from client_contracts k join proposals p on p.id = k.proposal_id where k.id = ${id}`;
  return row ? toContract(row) : null;
}

/** CC-2026-0001: one atomic counter row per year, the same way proposals are numbered. */
async function nextNumber(tx: Tx, year: number): Promise<string> {
  await tx`insert into client_contract_counters (year, last_number) values (${year}, 1) on duplicate key update last_number = last_number + 1`;
  const [row] = await tx<{ last_number: number }[]>`select last_number from client_contract_counters where year = ${year}`;
  return `CC-${year}-${String(row.last_number).padStart(4, "0")}`;
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * A draft contract from an accepted proposal. It takes its own copy of the proposal's prices, payment schedule,
 * technical sections and timeline, the client's details as a starting point, and the clauses of a template.
 * A proposal has at most one contract that isn't cancelled: the proposal row is locked while that is checked.
 */
export async function createClientContract(input: { proposalId: string; templateId: string | null }, createdBy: string): Promise<CreateResult> {
  const proposal = await getProposal(input.proposalId);
  if (!proposal) return { ok: false, error: "العرض مش موجود" };
  if (proposal.status !== "accepted") return { ok: false, error: "العقد بيتعمل من عرض العميل قبله بس" };
  const template = input.templateId ? await getClientTemplate(input.templateId) : ((await listClientTemplates())[0] ?? null);
  if (input.templateId && !template) return { ok: false, error: "القالب مش موجود" };
  const deal = await getDeal(proposal.dealId);
  if (!deal) return { ok: false, error: "الصفقة مش موجودة" };

  const totals = computeTotals(proposal.items, proposal.discountMinor, proposal.taxRateBp);
  if (totals.totalMinor <= 0) return { ok: false, error: "إجمالي العرض صفر، مينفعش يتعمل عليه عقد" };
  const amounts = splitPayments(totals.totalMinor, proposal.milestones.map((m) => m.percentBp));
  const milestones: ContractMilestone[] = proposal.milestones.map((m, i) => ({ title: m.title, percentBp: m.percentBp, amountMinor: amounts[i] }));

  return sql().begin(async (tx): Promise<CreateResult> => {
    const [locked] = await tx<{ status: string }[]>`select status from proposals where id = ${proposal.id} for update`;
    if (locked?.status !== "accepted") return { ok: false, error: "العقد بيتعمل من عرض العميل قبله بس" };
    const [existing] = await tx<{ number: string }[]>`select number from client_contracts where proposal_id = ${proposal.id} and status <> 'cancelled' limit 1`;
    if (existing) return { ok: false, error: `العرض ده عليه عقد بالفعل (${existing.number}). الغيه الأول لو عايز عقد جديد.` };
    const id = randomUUID();
    const number = await nextNumber(tx as unknown as Tx, new Date().getFullYear());
    await tx`
      insert into client_contracts (id, number, proposal_id, deal_id, client_id, template_id, title, client_name, client_representative, client_phone, client_email,
                                    currency, items, discount_minor, tax_rate_bp, total_minor, milestones, sections, timeline, clauses, created_by)
      values (${id}, ${number}, ${proposal.id}, ${proposal.dealId}, ${deal.clientId}, ${template?.id ?? null}, ${proposal.title}, ${deal.clientName},
              ${deal.contactName ?? ""}, ${deal.contactPhone ?? deal.clientPhone ?? ""}, ${deal.contactEmail ?? deal.clientEmail ?? ""},
              ${proposal.currency}, ${tx.json(proposal.items)}, ${totals.discountMinor}, ${proposal.taxRateBp}, ${totals.totalMinor}, ${tx.json(milestones)},
              ${tx.json(proposal.sections)}, ${tx.json(proposal.timeline)}, ${tx.json(template?.clauses ?? [])}, ${createdBy})`;
    await logActivity(tx as unknown as Tx, proposal.dealId, createdBy, `اتعمل عقد العميل ${number} من العرض ${proposal.number}`);
    return { ok: true, id };
  });
}

/** The editor's payload: everything arrives as text and is parsed here, once. */
export const clientContractInputSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان العقد").max(200),
  clientName: z.string().trim().min(2, "اكتب اسم العميل").max(160),
  clientRepresentative: z.string().trim().max(120),
  clientIdNumber: z.string().trim().max(40),
  clientAddress: z.string().trim().max(300),
  clientPhone: z.string().trim().max(30),
  clientEmail: z.string().trim().max(254),
  startDate: z.string().trim().max(10),
  clauses: clausesSchema,
});
export type ClientContractInput = z.input<typeof clientContractInputSchema>;

export type ParsedClientContract = Pick<
  ClientContract,
  "title" | "clientName" | "clientRepresentative" | "clientIdNumber" | "clientAddress" | "clientPhone" | "clientEmail" | "startDate" | "clauses"
>;

const toAsciiDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function parseClientContractInput(raw: unknown): { ok: true; data: ParsedClientContract } | { ok: false; error: string } {
  const parsed = clientContractInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات العقد غير صالحة" };
  const v = parsed.data;
  const phone = normalizePhone(v.clientPhone);
  if (phone !== "" && !PHONE_RE.test(phone)) return { ok: false, error: "رقم موبايل العميل غير صحيح" };
  const email = v.clientEmail.toLowerCase();
  if (email !== "" && !EMAIL_RE.test(email)) return { ok: false, error: "إيميل العميل غير صحيح" };
  if (v.startDate !== "" && !isIsoDate(v.startDate)) return { ok: false, error: "تاريخ البدء غير صالح" };
  return {
    ok: true,
    data: {
      title: v.title,
      clientName: v.clientName,
      clientRepresentative: v.clientRepresentative,
      clientIdNumber: toAsciiDigits(v.clientIdNumber),
      clientAddress: v.clientAddress,
      clientPhone: phone,
      clientEmail: email,
      startDate: v.startDate === "" ? null : v.startDate,
      clauses: v.clauses,
    },
  };
}

/** Only a draft can be edited: once printed for signing, the text must stay exactly as it was printed. */
export async function saveClientContract(id: string, data: ParsedClientContract): Promise<Result> {
  return sql().begin(async (tx): Promise<Result> => {
    const [current] = await tx<{ status: ClientContractStatus }[]>`select status from client_contracts where id = ${id} for update`;
    if (!current) return { ok: false, error: "العقد مش موجود" };
    if (current.status !== "draft") return { ok: false, error: "العقد مقفول للتعديل، رجّعه مسودة الأول" };
    await tx`
      update client_contracts set title = ${data.title}, client_name = ${data.clientName}, client_representative = ${data.clientRepresentative},
             client_id_number = ${data.clientIdNumber}, client_address = ${data.clientAddress}, client_phone = ${data.clientPhone}, client_email = ${data.clientEmail},
             start_date = ${data.startDate}, clauses = ${tx.json(data.clauses)}, updated_at = now(3)
      where id = ${id}`;
    return { ok: true };
  });
}

/** The facts a clause's tokens are filled from (the company's name comes from the company settings). */
export async function contractFacts(contract: ClientContract) {
  const company = await getCompany();
  return { ...contract, companyName: company.name || "Coder Nation" };
}

/** Locks a complete draft for printing and signing. Payments can be recorded from here on. */
export async function markClientContractReady(id: string, userId: string): Promise<Result> {
  const contract = await getClientContract(id);
  if (!contract) return { ok: false, error: "العقد مش موجود" };
  if (contract.status !== "draft") return { ok: false, error: "العقد مش مسودة" };
  const problems = clientContractProblems(await contractFacts(contract));
  if (problems.length > 0) return { ok: false, error: problems[0] };
  return sql().begin(async (tx): Promise<Result> => {
    const changed = await tx`update client_contracts set status = 'ready', ready_at = now(3), updated_at = now(3) where id = ${id} and status = 'draft'`;
    if (changed.count === 0) return { ok: false, error: "العقد مش مسودة" };
    await logActivity(tx as unknown as Tx, contract.dealId, userId, `عقد العميل ${contract.number} جاهز للتوقيع`);
    return { ok: true };
  });
}

/** Back to draft to fix something before it is signed, as long as no money was recorded against it. */
export async function clientContractBackToDraft(id: string): Promise<Result> {
  return sql().begin(async (tx): Promise<Result> => {
    const [row] = await tx<{ status: ClientContractStatus }[]>`select status from client_contracts where id = ${id} for update`;
    if (!row) return { ok: false, error: "العقد مش موجود" };
    if (row.status !== "ready") return { ok: false, error: "العقد بيرجع مسودة وهو «جاهز للتوقيع» بس" };
    const [paid] = await tx<{ n: number }[]>`select count(*) as n from invoices where contract_id = ${id} and status = 'issued'`;
    if (Number(paid.n) > 0) return { ok: false, error: "اتسجّلت دفعات على العقد ده، فمينفعش يتعدّل" };
    await tx`update client_contracts set status = 'draft', ready_at = null, updated_at = now(3) where id = ${id}`;
    return { ok: true };
  });
}

export const signInputSchema = z.object({
  signedOn: z.string().trim().refine(isIsoDate, "تاريخ التوقيع غير صالح"),
  signedByName: z.string().trim().min(2, "اكتب اسم اللي وقّع من طرف العميل").max(120),
});

/** Records the signature on paper: the day and who signed for the client. */
export async function markClientContractSigned(id: string, input: z.infer<typeof signInputSchema>, userId: string): Promise<Result> {
  if (input.signedOn > todayInCairo()) return { ok: false, error: "تاريخ التوقيع في المستقبل" };
  return sql().begin(async (tx): Promise<Result> => {
    const [row] = await tx<{ status: ClientContractStatus; deal_id: string; number: string }[]>`select status, deal_id, number from client_contracts where id = ${id} for update`;
    if (!row) return { ok: false, error: "العقد مش موجود" };
    if (row.status !== "ready") return { ok: false, error: "العقد لازم يبقى «جاهز للتوقيع» الأول" };
    await tx`update client_contracts set status = 'signed', signed_on = ${input.signedOn}, signed_by_name = ${input.signedByName}, updated_at = now(3) where id = ${id}`;
    await logActivity(tx as unknown as Tx, row.deal_id, userId, `العميل وقّع العقد ${row.number}`);
    return { ok: true };
  });
}

/** Cancels a contract. One with live invoices can't be: the invoices are voided first, so the money always adds up. */
export async function cancelClientContract(id: string, reason: string, userId: string): Promise<Result> {
  const why = reason.trim();
  if (why.length < 2 || why.length > 300) return { ok: false, error: "اكتب سبب الإلغاء" };
  return sql().begin(async (tx): Promise<Result> => {
    const [row] = await tx<{ status: ClientContractStatus; deal_id: string; number: string }[]>`select status, deal_id, number from client_contracts where id = ${id} for update`;
    if (!row) return { ok: false, error: "العقد مش موجود" };
    if (row.status === "cancelled") return { ok: false, error: "العقد ملغي بالفعل" };
    const [paid] = await tx<{ n: number }[]>`select count(*) as n from invoices where contract_id = ${id} and status = 'issued'`;
    if (Number(paid.n) > 0) return { ok: false, error: "على العقد فواتير سارية، الغيها الأول" };
    await tx`update client_contracts set status = 'cancelled', cancel_reason = ${why}, updated_at = now(3) where id = ${id}`;
    await logActivity(tx as unknown as Tx, row.deal_id, userId, `اتلغى عقد العميل ${row.number}: ${why}`);
    return { ok: true };
  });
}

/** Accepted proposals that don't have a live contract yet: the next contracts to make. */
export async function proposalsAwaitingContract(): Promise<{ id: string; number: string; title: string; clientName: string }[]> {
  return sql()<{ id: string; number: string; title: string; clientName: string }[]>`
    select p.id, p.number, p.title, c.name as clientName
    from proposals p join deals d on d.id = p.deal_id join clients c on c.id = d.client_id
    where p.status = 'accepted' and not exists (select 1 from client_contracts k where k.proposal_id = p.id and k.status <> 'cancelled')
    order by p.updated_at desc limit 50`;
}
