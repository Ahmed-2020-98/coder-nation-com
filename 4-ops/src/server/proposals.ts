import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CURRENCIES, type Currency, type ProposalStatus } from "@/lib/crm-rules";
import { blockingProblems, type ProposalDraft } from "@/lib/proposal-rules";
import { templateFor } from "@/lib/proposal-templates";
import { milestonesAreComplete, parseMoney } from "@/lib/money";
import { sql } from "./db";
import { fromJson } from "./sql";

export type ProposalItem = { title: string; description: string; quantity: number; unitPriceMinor: number };
export type Milestone = { title: string; percentBp: number };

export type Proposal = {
  id: string;
  dealId: string;
  dealTitle: string;
  clientName: string;
  number: string;
  status: ProposalStatus;
  title: string;
  currency: Currency;
  taxRateBp: number | null;
  discountMinor: number;
  validUntil: string | null;
  intro: string;
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
  items: ProposalItem[];
  milestones: Milestone[];
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
};

type ProposalRow = {
  id: string;
  deal_id: string;
  deal_title: string;
  client_name: string;
  number: string;
  status: ProposalStatus;
  title: string;
  currency: string;
  tax_rate_bp: number | null;
  discount_minor: string;
  valid_until: string | null;
  intro: string;
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
};

const SELECT = `p.id, p.deal_id, d.title as deal_title, c.name as client_name, p.number, p.status, p.title, p.currency, p.tax_rate_bp,
  p.discount_minor, date_format(p.valid_until, '%Y-%m-%d') as valid_until, p.intro, p.sections, p.timeline, p.created_at, p.updated_at, p.sent_at`;

export type ProposalSummary = Omit<Proposal, "items" | "milestones" | "sections" | "timeline" | "intro"> & { totalMinor: number };

export async function listProposals(dealId?: string): Promise<ProposalSummary[]> {
  const db = sql();
  const rows = await db<(ProposalRow & { subtotal: string })[]>`
    select ${db.unsafe(SELECT)}, coalesce((select sum(i.quantity * i.unit_price_minor) from proposal_items i where i.proposal_id = p.id), 0) as subtotal
    from proposals p join deals d on d.id = p.deal_id join clients c on c.id = d.client_id
    ${dealId ? db`where p.deal_id = ${dealId}` : db``}
    order by p.created_at desc limit 300`;
  const { computeTotals } = await import("@/lib/money");
  return rows.map((row) => {
    const discount = Number(row.discount_minor);
    return {
      id: row.id,
      dealId: row.deal_id,
      dealTitle: row.deal_title,
      clientName: row.client_name,
      number: row.number,
      status: row.status,
      title: row.title,
      currency: row.currency.trim() as Currency,
      taxRateBp: row.tax_rate_bp,
      discountMinor: discount,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sentAt: row.sent_at,
      totalMinor: computeTotals([{ quantity: 1, unitPriceMinor: Number(row.subtotal) }], discount, row.tax_rate_bp).totalMinor,
    };
  });
}

export async function getProposal(id: string): Promise<Proposal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [row] = await db<ProposalRow[]>`
    select ${db.unsafe(SELECT)} from proposals p join deals d on d.id = p.deal_id join clients c on c.id = d.client_id where p.id = ${id}`;
  if (!row) return null;
  const items = await db<{ title: string; description: string; quantity: number; unit_price_minor: string }[]>`
    select title, description, quantity, unit_price_minor from proposal_items where proposal_id = ${id} order by position`;
  const milestones = await db<{ title: string; percent_bp: number }[]>`
    select title, percent_bp from proposal_milestones where proposal_id = ${id} order by position`;
  return {
    id: row.id,
    dealId: row.deal_id,
    dealTitle: row.deal_title,
    clientName: row.client_name,
    number: row.number,
    status: row.status,
    title: row.title,
    currency: row.currency.trim() as Currency,
    taxRateBp: row.tax_rate_bp,
    discountMinor: Number(row.discount_minor),
    validUntil: row.valid_until,
    intro: row.intro,
    sections: fromJson(row.sections),
    timeline: fromJson(row.timeline),
    items: items.map((i) => ({ title: i.title, description: i.description, quantity: i.quantity, unitPriceMinor: Number(i.unit_price_minor) })),
    milestones: milestones.map((m) => ({ title: m.title, percentBp: m.percent_bp })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
  };
}

/** P-2026-0001: one atomic counter row per year, so two people creating at once can never get the same number. */
export async function nextNumber(tx: ReturnType<typeof sql>, year: number): Promise<string> {
  // The upsert locks the year's row until the transaction ends, so the read below sees exactly this call's number.
  await tx`insert into proposal_counters (year, last_number) values (${year}, 1) on duplicate key update last_number = last_number + 1`;
  const [row] = await tx<{ last_number: number }[]>`select last_number from proposal_counters where year = ${year}`;
  return `P-${year}-${String(row.last_number).padStart(4, "0")}`;
}

export async function createProposalForDeal(dealId: string, userId: string): Promise<string | null> {
  return sql().begin(async (tx) => {
    const [deal] = await tx<{ title: string; service: string | null; currency: string | null }[]>`select title, service, currency from deals where id = ${dealId}`;
    if (!deal) return null;
    const template = templateFor(deal.service);
    const number = await nextNumber(tx as unknown as ReturnType<typeof sql>, new Date().getFullYear());
    const currency = (deal.currency?.trim() as Currency | undefined) ?? "EGP";
    const proposalId = randomUUID();
    await tx`
      insert into proposals (id, deal_id, number, title, currency, sections, timeline, created_by)
      values (${proposalId}, ${dealId}, ${number}, ${`عرض ${deal.title}`}, ${currency}, ${tx.json(template.sections)}, ${tx.json(template.timeline)}, ${userId})`;
    for (const [position, m] of template.milestones.entries()) {
      await tx`insert into proposal_milestones (id, proposal_id, position, title, percent_bp) values (${randomUUID()}, ${proposalId}, ${position}, ${m.title}, ${m.percentBp})`;
    }
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${dealId}, ${userId}, 'system', ${`اتعمل العرض ${number}`})`;
    return proposalId;
  });
}

/** Copies a proposal (any status) into a fresh draft with a new number: the way to revise something already sent. */
export async function duplicateProposal(id: string, userId: string): Promise<string | null> {
  const source = await getProposal(id);
  if (!source) return null;
  return sql().begin(async (tx) => {
    const number = await nextNumber(tx as unknown as ReturnType<typeof sql>, new Date().getFullYear());
    const copyId = randomUUID();
    await tx`
      insert into proposals (id, deal_id, number, title, currency, tax_rate_bp, discount_minor, valid_until, intro, sections, timeline, created_by)
      values (${copyId}, ${source.dealId}, ${number}, ${source.title}, ${source.currency}, ${source.taxRateBp}, ${source.discountMinor}, ${source.validUntil}, ${source.intro},
              ${tx.json(source.sections)}, ${tx.json(source.timeline)}, ${userId})`;
    await insertChildren(tx as unknown as ReturnType<typeof sql>, copyId, source.items, source.milestones);
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${source.dealId}, ${userId}, 'system', ${`اتعملت نسخة ${number} من ${source.number}`})`;
    return copyId;
  });
}

async function insertChildren(tx: ReturnType<typeof sql>, proposalId: string, items: ProposalItem[], milestones: Milestone[]) {
  for (const [position, item] of items.entries()) {
    await tx`insert into proposal_items (id, proposal_id, position, title, description, quantity, unit_price_minor)
             values (${randomUUID()}, ${proposalId}, ${position}, ${item.title}, ${item.description}, ${item.quantity}, ${item.unitPriceMinor})`;
  }
  for (const [position, m] of milestones.entries()) {
    await tx`insert into proposal_milestones (id, proposal_id, position, title, percent_bp) values (${randomUUID()}, ${proposalId}, ${position}, ${m.title}, ${m.percentBp})`;
  }
}

/** The editor's payload. Prices and percents come as text (what the person typed) and are parsed here, once. */
export const proposalInputSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان العرض").max(200),
  currency: z.enum(CURRENCIES),
  taxPercent: z.string().trim().max(6),
  discount: z.string().trim().max(20),
  validUntil: z.string().trim().max(10),
  intro: z.string().trim().max(4000),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1, "كل بند لازم يبقى له عنوان").max(200),
        description: z.string().trim().max(1000),
        quantity: z.coerce.number().int("الكمية رقم صحيح").min(1).max(10000),
        price: z.string().trim().max(20),
      }),
    )
    .max(60),
  milestones: z
    .array(z.object({ title: z.string().trim().min(1, "كل دفعة لازم يبقى لها اسم").max(200), percent: z.string().trim().max(7) }))
    .max(12),
  sections: z.array(z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().max(6000) })).max(20),
  timeline: z.array(z.object({ title: z.string().trim().min(1).max(200), weeks: z.coerce.number().int().min(1).max(260) })).max(20),
});
export type ProposalInput = z.input<typeof proposalInputSchema>;

export type ParsedProposal = ProposalDraft & {
  title: string;
  currency: Currency;
  validUntil: string | null;
  items: ProposalItem[];
};
export type ParseResult = { ok: true; data: ParsedProposal } | { ok: false; error: string };

export function parseProposalInput(raw: unknown): ParseResult {
  const parsed = proposalInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات العرض غير صالحة" };
  const v = parsed.data;
  const items: ProposalItem[] = [];
  for (const [index, item] of v.items.entries()) {
    const price = parseMoney(item.price);
    if (price === null || price > 100_000_000_000) return { ok: false, error: `سعر البند ${index + 1} غير صالح (أرقام فقط، حتى خانتين عشريتين)` };
    items.push({ title: item.title, description: item.description, quantity: item.quantity, unitPriceMinor: price });
  }
  const discount = v.discount === "" ? 0 : parseMoney(v.discount);
  if (discount === null) return { ok: false, error: "قيمة الخصم غير صالحة" };
  let taxRateBp: number | null = null;
  if (v.taxPercent !== "") {
    const rate = Number(v.taxPercent.replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: "نسبة الضريبة لازم تبقى بين 0 و100" };
    taxRateBp = Math.round(rate * 100);
  }
  const milestones: Milestone[] = [];
  for (const [index, m] of v.milestones.entries()) {
    const percent = Number(m.percent.replace(",", "."));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { ok: false, error: `نسبة الدفعة ${index + 1} لازم تبقى بين 0 و100` };
    milestones.push({ title: m.title, percentBp: Math.round(percent * 100) });
  }
  if (v.validUntil !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil)) return { ok: false, error: "تاريخ صلاحية العرض غير صالح" };
  return {
    ok: true,
    data: {
      title: v.title,
      currency: v.currency,
      validUntil: v.validUntil === "" ? null : v.validUntil,
      items,
      milestones,
      discountMinor: discount,
      taxRateBp,
      intro: v.intro,
      sections: v.sections,
      timeline: v.timeline,
    },
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Only a draft can be edited: once sent, the numbers the client holds must stay true (revise via duplicate). */
export async function saveProposal(id: string, data: ParsedProposal): Promise<SaveResult> {
  return sql().begin(async (tx): Promise<SaveResult> => {
    const [current] = await tx<{ status: ProposalStatus }[]>`select status from proposals where id = ${id} for update`;
    if (!current) return { ok: false, error: "العرض مش موجود" };
    if (current.status !== "draft") return { ok: false, error: "العرض اتبعت، اعمل نسخة جديدة منه عشان تعدّل" };
    await tx`
      update proposals set title = ${data.title}, currency = ${data.currency}, tax_rate_bp = ${data.taxRateBp}, discount_minor = ${data.discountMinor},
             valid_until = ${data.validUntil}, intro = ${data.intro}, sections = ${tx.json(data.sections)}, timeline = ${tx.json(data.timeline)}, updated_at = now(3)
      where id = ${id}`;
    await tx`delete from proposal_items where proposal_id = ${id}`;
    await tx`delete from proposal_milestones where proposal_id = ${id}`;
    await insertChildren(tx as unknown as ReturnType<typeof sql>, id, data.items, data.milestones);
    return { ok: true };
  });
}

/** Marks a draft as sent (only if it is complete) and moves its deal forward to "عرض مُرسل" when it is earlier than that. */
export async function markSent(id: string, userId: string): Promise<SaveResult> {
  const proposal = await getProposal(id);
  if (!proposal) return { ok: false, error: "العرض مش موجود" };
  if (proposal.status !== "draft") return { ok: false, error: "العرض اتبعت قبل كده" };
  const problems = blockingProblems(proposal);
  if (problems.length > 0) return { ok: false, error: problems[0] };
  return sql().begin(async (tx): Promise<SaveResult> => {
    await tx`update proposals set status = 'sent', sent_at = now(3), updated_at = now(3) where id = ${id}`;
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${proposal.dealId}, ${userId}, 'system', ${`اتبعت العرض ${proposal.number}`})`;
    const moved = await tx`
      update deals set stage = 'proposal_sent', stage_changed_at = now(3), updated_at = now(3)
      where id = ${proposal.dealId} and stage in ('new', 'contacted', 'meeting')`;
    if (moved.count > 0) await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${proposal.dealId}, ${userId}, 'stage', 'اتنقلت تلقائيًا إلى «عرض مُرسل»')`;
    return { ok: true };
  });
}

/** The accepted proposal is the agreed price, so the deal's expected value (and currency) follow it. */
async function syncDealValue(tx: ReturnType<typeof sql>, proposalId: string, dealId: string, userId: string): Promise<void> {
  const [row] = await tx<{ subtotal: string; discount_minor: string; tax_rate_bp: number | null; currency: string }[]>`
    select coalesce((select sum(i.quantity * i.unit_price_minor) from proposal_items i where i.proposal_id = p.id), 0) as subtotal, p.discount_minor, p.tax_rate_bp, p.currency
    from proposals p where p.id = ${proposalId}`;
  const { computeTotals } = await import("@/lib/money");
  const totalMinor = computeTotals([{ quantity: 1, unitPriceMinor: Number(row.subtotal) }], Number(row.discount_minor), row.tax_rate_bp).totalMinor;
  const currency = row.currency.trim();
  // `<=>` is the NULL-safe comparison: a deal without a value yet counts as different.
  const changed = await tx`
    update deals set value_minor = ${totalMinor}, currency = ${currency}, updated_at = now(3)
    where id = ${dealId} and (not (value_minor <=> ${totalMinor}) or not (currency <=> ${currency}))`;
  if (changed.count > 0) await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${dealId}, ${userId}, 'system', 'اتحدّثت قيمة الصفقة لتطابق العرض المقبول')`;
}

export async function setOutcome(id: string, outcome: "accepted" | "rejected", userId: string): Promise<SaveResult> {
  return sql().begin(async (tx): Promise<SaveResult> => {
    const [row] = await tx<{ status: ProposalStatus; deal_id: string; number: string }[]>`select status, deal_id, number from proposals where id = ${id} for update`;
    if (!row) return { ok: false, error: "العرض مش موجود" };
    if (row.status !== "sent") return { ok: false, error: "النتيجة بتتسجّل للعرض المُرسل بس" };
    await tx`update proposals set status = ${outcome}, updated_at = now(3) where id = ${id}`;
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${row.deal_id}, ${userId}, 'system', ${`العرض ${row.number} ${outcome === "accepted" ? "اتقبل" : "اترفض"}`})`;
    if (outcome === "accepted") await syncDealValue(tx as unknown as ReturnType<typeof sql>, id, row.deal_id, userId);
    return { ok: true };
  });
}

export { milestonesAreComplete };
