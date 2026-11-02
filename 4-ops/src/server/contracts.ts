import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DEFAULT_SHIFT, isTime, toMinutes } from "@/lib/attendance-rules";
import { contractProblems, type Clause, type ContractStatus } from "@/lib/contract-rules";
import { CURRENCIES, EMAIL_RE, PHONE_RE, normalizePhone, type Currency } from "@/lib/crm-rules";
import { isIsoDate } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { getSchedule } from "./attendance";
import { sql } from "./db";
import { fromJson } from "./sql";

type Result = { ok: true } | { ok: false; error: string };
const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

// ---------- templates ----------

export type ContractTemplate = { id: string; title: string; jobTitle: string; clauses: Clause[]; updatedAt: Date };

type TemplateRow = { id: string; title: string; job_title: string; clauses: Clause[]; updated_at: Date };
const toTemplate = (r: TemplateRow): ContractTemplate => ({ id: r.id, title: r.title, jobTitle: r.job_title, clauses: fromJson(r.clauses), updatedAt: r.updated_at });

export async function listTemplates(): Promise<ContractTemplate[]> {
  const rows = await sql()<TemplateRow[]>`select id, title, job_title, clauses, updated_at from contract_templates order by title`;
  return rows.map(toTemplate);
}

export async function getTemplate(id: string): Promise<ContractTemplate | null> {
  if (!isId(id)) return null;
  const [row] = await sql()<TemplateRow[]>`select id, title, job_title, clauses, updated_at from contract_templates where id = ${id}`;
  return row ? toTemplate(row) : null;
}

const clausesSchema = z.array(z.object({ title: z.string().trim().min(1, "كل بند لازم يبقى له عنوان").max(120), body: z.string().trim().max(6000) })).max(30, "أقصى عدد 30 بند");

export const templateInputSchema = z.object({
  title: z.string().trim().min(2, "اكتب اسم القالب").max(200),
  jobTitle: z.string().trim().min(2, "اكتب المسمى الوظيفي").max(120),
  clauses: clausesSchema,
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export async function createTemplate(): Promise<string> {
  const id = randomUUID();
  await sql()`insert into contract_templates (id, title, job_title, clauses) values (${id}, 'قالب جديد', 'المسمى الوظيفي', ${sql().json([])})`;
  return id;
}

export async function saveTemplate(id: string, input: TemplateInput): Promise<Result> {
  const result = await sql()`
    update contract_templates set title = ${input.title}, job_title = ${input.jobTitle}, clauses = ${sql().json(input.clauses)}, updated_at = now(3) where id = ${id}`;
  return result.count > 0 ? { ok: true } : { ok: false, error: "القالب مش موجود" };
}

/** Contracts made from it keep their own copy of the clauses, so deleting a template never changes a contract. */
export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await sql()`delete from contract_templates where id = ${id}`;
  return result.count > 0;
}

// ---------- contracts ----------

export type Contract = {
  id: string;
  number: string;
  userId: string;
  templateId: string | null;
  status: ContractStatus;
  title: string;
  employeeName: string;
  jobTitle: string;
  phone: string;
  email: string;
  nationalId: string;
  address: string;
  startDate: string | null;
  workStart: string;
  workEnd: string;
  workDays: number[];
  salaryMinor: number | null;
  currency: Currency;
  commission: string;
  clauses: Clause[];
  sentAt: Date | null;
  respondedAt: Date | null;
  declineReason: string;
  createdAt: Date;
  updatedAt: Date;
};

type ContractRow = {
  id: string;
  number: string;
  user_id: string;
  template_id: string | null;
  status: ContractStatus;
  title: string;
  employee_name: string;
  job_title: string;
  phone: string;
  email: string;
  national_id: string;
  address: string;
  start_date: string | null;
  work_start: string;
  work_end: string;
  work_days: number[];
  salary_minor: string | null;
  currency: string;
  commission: string;
  clauses: Clause[];
  sent_at: Date | null;
  responded_at: Date | null;
  decline_reason: string;
  created_at: Date;
  updated_at: Date;
};

const SELECT = `id, number, user_id, template_id, status, title, employee_name, job_title, phone, email, national_id, address,
  date_format(start_date, '%Y-%m-%d') as start_date, date_format(work_start, '%H:%i') as work_start, date_format(work_end, '%H:%i') as work_end,
  work_days, salary_minor, currency, commission, clauses, sent_at, responded_at, decline_reason, created_at, updated_at`;

const toContract = (r: ContractRow): Contract => ({
  id: r.id,
  number: r.number,
  userId: r.user_id,
  templateId: r.template_id,
  status: r.status,
  title: r.title,
  employeeName: r.employee_name,
  jobTitle: r.job_title,
  phone: r.phone,
  email: r.email,
  nationalId: r.national_id,
  address: r.address,
  startDate: r.start_date,
  workStart: r.work_start,
  workEnd: r.work_end,
  workDays: [...fromJson<number[]>(r.work_days)].sort((a, b) => a - b),
  salaryMinor: r.salary_minor === null ? null : Number(r.salary_minor),
  currency: r.currency.trim() as Currency,
  commission: r.commission,
  clauses: fromJson(r.clauses),
  sentAt: r.sent_at,
  respondedAt: r.responded_at,
  declineReason: r.decline_reason,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ContractSummary = Pick<Contract, "id" | "number" | "userId" | "status" | "title" | "employeeName" | "jobTitle" | "sentAt" | "respondedAt" | "createdAt">;

/** Every contract (owner), or one person's contracts that were sent to them (drafts are the owner's business). */
export async function listContracts(filter: { userId?: string } = {}): Promise<ContractSummary[]> {
  const db = sql();
  const rows = await db<ContractRow[]>`
    select ${db.unsafe(SELECT)} from contracts
    ${filter.userId ? db`where user_id = ${filter.userId} and status <> 'draft'` : db``}
    order by created_at desc limit 300`;
  return rows.map((r) => {
    const c = toContract(r);
    return { id: c.id, number: c.number, userId: c.userId, status: c.status, title: c.title, employeeName: c.employeeName, jobTitle: c.jobTitle, sentAt: c.sentAt, respondedAt: c.respondedAt, createdAt: c.createdAt };
  });
}

export async function getContract(id: string): Promise<Contract | null> {
  if (!isId(id)) return null;
  const db = sql();
  const [row] = await db<ContractRow[]>`select ${db.unsafe(SELECT)} from contracts where id = ${id}`;
  return row ? toContract(row) : null;
}

/** How many contracts wait for this person's answer (the home page reminds them). */
export async function pendingContractCount(userId: string): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`select count(*) as n from contracts where user_id = ${userId} and status = 'sent'`;
  return Number(row.n);
}

/** C-2026-0001: one atomic counter row per year, the same way proposals are numbered. */
async function nextNumber(tx: ReturnType<typeof sql>, year: number): Promise<string> {
  await tx`insert into contract_counters (year, last_number) values (${year}, 1) on duplicate key update last_number = last_number + 1`;
  const [row] = await tx<{ last_number: number }[]>`select last_number from contract_counters where year = ${year}`;
  return `C-${year}-${String(row.last_number).padStart(4, "0")}`;
}

/**
 * A new draft for a team member, from a template (or empty). The person's name, email and shift are copied in as a
 * starting point; from then on the contract has its own values.
 */
export async function createContract(input: { userId: string; templateId: string | null }, createdBy: string): Promise<string | null> {
  if (!isId(input.userId)) return null;
  const [person] = await sql()<{ name: string; email: string }[]>`select name, email from users where id = ${input.userId}`;
  if (!person) return null;
  const template = input.templateId ? await getTemplate(input.templateId) : null;
  if (input.templateId && !template) return null;
  const shift = (await getSchedule(input.userId)) ?? DEFAULT_SHIFT;
  return sql().begin(async (tx) => {
    const id = randomUUID();
    const number = await nextNumber(tx as unknown as ReturnType<typeof sql>, new Date().getFullYear());
    await tx`
      insert into contracts (id, number, user_id, template_id, title, employee_name, job_title, email, work_start, work_end, work_days, clauses, created_by)
      values (${id}, ${number}, ${input.userId}, ${template?.id ?? null}, ${template?.title ?? "اتفاق عمل"}, ${person.name}, ${template?.jobTitle ?? ""}, ${person.email},
              ${shift.startTime}, ${shift.endTime}, ${tx.json(shift.workDays)}, ${tx.json(template?.clauses ?? [])}, ${createdBy})`;
    return id;
  });
}

/** Copies a contract (any status) into a fresh draft with a new number: the way to revise one already sent or answered. */
export async function duplicateContract(id: string, createdBy: string): Promise<string | null> {
  const source = await getContract(id);
  if (!source) return null;
  return sql().begin(async (tx) => {
    const copyId = randomUUID();
    const number = await nextNumber(tx as unknown as ReturnType<typeof sql>, new Date().getFullYear());
    await tx`
      insert into contracts (id, number, user_id, template_id, title, employee_name, job_title, phone, email, national_id, address, start_date,
                             work_start, work_end, work_days, salary_minor, currency, commission, clauses, created_by)
      values (${copyId}, ${number}, ${source.userId}, ${source.templateId}, ${source.title}, ${source.employeeName}, ${source.jobTitle}, ${source.phone}, ${source.email},
              ${source.nationalId}, ${source.address}, ${source.startDate}, ${source.workStart}, ${source.workEnd}, ${tx.json(source.workDays)}, ${source.salaryMinor},
              ${source.currency}, ${source.commission}, ${tx.json(source.clauses)}, ${createdBy})`;
    return copyId;
  });
}

/** The editor's payload: everything arrives as text (what was typed) and is parsed here, once. */
export const contractInputSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان العقد").max(200),
  employeeName: z.string().trim().min(2, "اكتب اسم الموظف").max(120),
  jobTitle: z.string().trim().max(120),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(254),
  nationalId: z.string().trim().max(30),
  address: z.string().trim().max(300),
  startDate: z.string().trim().max(10),
  workStart: z.string().trim().max(5),
  workEnd: z.string().trim().max(5),
  workDays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
  salary: z.string().trim().max(20),
  currency: z.enum(CURRENCIES),
  commission: z.string().trim().max(500),
  clauses: clausesSchema,
});
export type ContractInput = z.input<typeof contractInputSchema>;

export type ParsedContract = Omit<Contract, "id" | "number" | "userId" | "templateId" | "status" | "sentAt" | "respondedAt" | "declineReason" | "createdAt" | "updatedAt">;

const toAsciiDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function parseContractInput(raw: unknown): { ok: true; data: ParsedContract } | { ok: false; error: string } {
  const parsed = contractInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات العقد غير صالحة" };
  const v = parsed.data;
  const phone = normalizePhone(v.phone);
  if (phone !== "" && !PHONE_RE.test(phone)) return { ok: false, error: "رقم الموبايل غير صحيح" };
  const email = v.email.toLowerCase();
  if (email !== "" && !EMAIL_RE.test(email)) return { ok: false, error: "الإيميل غير صحيح" };
  const nationalId = toAsciiDigits(v.nationalId).replace(/\s/g, "");
  if (nationalId !== "" && !/^[0-9A-Za-z]{5,20}$/.test(nationalId)) return { ok: false, error: "الرقم القومي غير صالح (أرقام فقط)" };
  if (v.startDate !== "" && !isIsoDate(v.startDate)) return { ok: false, error: "تاريخ البدء غير صالح" };
  if (!isTime(v.workStart) || !isTime(v.workEnd)) return { ok: false, error: "مواعيد العمل لازم تبقى بالشكل 09:00" };
  if (toMinutes(v.workEnd) <= toMinutes(v.workStart)) return { ok: false, error: "نهاية الدوام لازم تبقى بعد بدايته" };
  const salary = v.salary === "" ? null : parseMoney(v.salary);
  if (v.salary !== "" && (salary === null || salary > 100_000_000_000)) return { ok: false, error: "المرتب غير صالح (أرقام فقط، حتى خانتين عشريتين)" };
  return {
    ok: true,
    data: {
      title: v.title,
      employeeName: v.employeeName,
      jobTitle: v.jobTitle,
      phone,
      email,
      nationalId,
      address: v.address,
      startDate: v.startDate === "" ? null : v.startDate,
      workStart: v.workStart,
      workEnd: v.workEnd,
      workDays: [...new Set(v.workDays)].sort((a, b) => a - b),
      salaryMinor: salary,
      currency: v.currency,
      commission: v.commission,
      clauses: v.clauses,
    },
  };
}

/** Only a draft can be edited: what the employee read (or agreed to) must stay exactly as it was. */
export async function saveContract(id: string, data: ParsedContract): Promise<Result> {
  return sql().begin(async (tx): Promise<Result> => {
    const [current] = await tx<{ status: ContractStatus }[]>`select status from contracts where id = ${id} for update`;
    if (!current) return { ok: false, error: "العقد مش موجود" };
    if (current.status !== "draft") return { ok: false, error: "العقد اتبعت للموظف، اسحبه أو اعمل نسخة جديدة عشان تعدّل" };
    await tx`
      update contracts set title = ${data.title}, employee_name = ${data.employeeName}, job_title = ${data.jobTitle}, phone = ${data.phone}, email = ${data.email},
             national_id = ${data.nationalId}, address = ${data.address}, start_date = ${data.startDate}, work_start = ${data.workStart}, work_end = ${data.workEnd},
             work_days = ${tx.json(data.workDays)}, salary_minor = ${data.salaryMinor}, currency = ${data.currency}, commission = ${data.commission},
             clauses = ${tx.json(data.clauses)}, updated_at = now(3)
      where id = ${id}`;
    return { ok: true };
  });
}

/** Sends a complete draft to the employee: from now on it shows in their account, waiting for their answer. */
export async function sendContract(id: string): Promise<Result> {
  const contract = await getContract(id);
  if (!contract) return { ok: false, error: "العقد مش موجود" };
  if (contract.status !== "draft") return { ok: false, error: "العقد اتبعت قبل كده" };
  const problems = contractProblems(contract);
  if (problems.length > 0) return { ok: false, error: problems[0] };
  const [person] = await sql()<{ active: boolean }[]>`select active from users where id = ${contract.userId}`;
  if (!person?.active) return { ok: false, error: "حساب الموظف موقوف، فعّله الأول عشان يقدر يشوف العقد" };
  const result = await sql()`update contracts set status = 'sent', sent_at = now(3), updated_at = now(3) where id = ${id} and status = 'draft'`;
  return result.count > 0 ? { ok: true } : { ok: false, error: "العقد اتبعت قبل كده" };
}

/** Takes a sent contract back to draft before the employee answers (to fix something). */
export async function withdrawContract(id: string): Promise<Result> {
  const result = await sql()`update contracts set status = 'draft', sent_at = null, updated_at = now(3) where id = ${id} and status = 'sent'`;
  return result.count > 0 ? { ok: true } : { ok: false, error: "العقد مش مستني موافقة، فمينفعش يتسحب" };
}

/**
 * The employee's answer, from their own account only. The row is locked, so an answer can't race a withdrawal; an
 * acceptance records when, and a hash of where from, as the evidence of the agreement.
 */
export async function respondToContract(
  input: { id: string; userId: string; answer: "accepted" | "declined"; reason: string },
  fingerprint: { ipHash: string; userAgent: string | null },
): Promise<Result> {
  const reason = input.reason.trim().slice(0, 500);
  return sql().begin(async (tx): Promise<Result> => {
    const [row] = await tx<{ user_id: string; status: ContractStatus }[]>`select user_id, status from contracts where id = ${input.id} for update`;
    if (!row || row.user_id !== input.userId || row.status === "draft") return { ok: false, error: "العقد مش موجود" };
    if (row.status !== "sent") return { ok: false, error: "اتسجّل ردك على العقد ده قبل كده" };
    await tx`
      update contracts set status = ${input.answer}, responded_at = now(3), decline_reason = ${input.answer === "declined" ? reason : ""},
             response_ip_hash = ${fingerprint.ipHash}, response_user_agent = ${fingerprint.userAgent}, updated_at = now(3)
      where id = ${input.id}`;
    return { ok: true };
  });
}
