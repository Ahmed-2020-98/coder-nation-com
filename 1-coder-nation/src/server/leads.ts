import "server-only";
import { z } from "zod";
import { content } from "@/content";
import { EMAIL_RE, LEAD_LIMITS, LEAD_STATUSES, PHONE_RE, normalizePhone, type LeadStatus } from "@/lib/lead-rules";
import { sql } from "./db";

const { errors, fields } = content.contact.form;

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  message: string | null;
  status: LeadStatus;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  message: string | null;
  status: LeadStatus;
  note: string;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = "id, name, phone, email, service, message, status, note, created_at, updated_at";
const toLead = (row: LeadRow): Lead => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  service: row.service,
  message: row.message,
  status: row.status,
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const emptyToNull = (value: string) => (value === "" ? null : value);

/** What the public form may send. Same rules as the browser, plus the ones a browser can't be trusted with. */
export const leadInputSchema = z.object({
  name: z.string().trim().min(LEAD_LIMITS.name.min, errors.name).max(LEAD_LIMITS.name.max, errors.name),
  phone: z.string().transform(normalizePhone).refine((value) => PHONE_RE.test(value), errors.phone),
  email: z
    .string()
    .trim()
    .max(LEAD_LIMITS.email, errors.email)
    .refine((value) => value === "" || EMAIL_RE.test(value), errors.email)
    .transform(emptyToNull),
  service: z
    .string()
    .trim()
    .refine((value) => value === "" || (fields.service.options as readonly string[]).includes(value), errors.service)
    .transform(emptyToNull),
  message: z.string().trim().max(LEAD_LIMITS.message, errors.message).transform(emptyToNull),
});
export type LeadInput = z.output<typeof leadInputSchema>;

export type LeadParse = { ok: true; data: LeadInput } | { ok: false; fieldErrors: Partial<Record<keyof LeadInput, string>> };

export function parseLeadInput(raw: Record<string, unknown>): LeadParse {
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  const result = leadInputSchema.safeParse({ name: text("name"), phone: text("phone"), email: text("email"), service: text("service"), message: text("message") });
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Partial<Record<keyof LeadInput, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof LeadInput;
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}

export async function createLead(input: LeadInput, meta: { ipHash: string | null; userAgent: string | null }): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    insert into leads (name, phone, email, service, message, ip_hash, user_agent)
    values (${input.name}, ${input.phone}, ${input.email}, ${input.service}, ${input.message}, ${meta.ipHash}, ${meta.userAgent})
    returning id`;
  return row.id;
}

export const PAGE_SIZE = 25;

export type LeadFilter = { status?: LeadStatus; q?: string; page?: number };

/** Search is a plain substring match (strpos), so a `%` or `_` typed by the admin is just a character, never a wildcard. */
function whereClause(filter: LeadFilter) {
  const db = sql();
  const q = filter.q?.trim().slice(0, 100);
  const digits = q ? normalizePhone(q) : "";
  return db`true
    ${filter.status ? db`and status = ${filter.status}` : db``}
    ${q ? db`and (strpos(lower(name), ${q.toLowerCase()}) > 0 or strpos(lower(coalesce(email, '')), ${q.toLowerCase()}) > 0 or (${digits.length >= 3} and strpos(phone, ${digits}) > 0))` : db``}`;
}

export async function listLeads(filter: LeadFilter): Promise<{ rows: Lead[]; total: number; page: number; pages: number }> {
  const db = sql();
  const where = whereClause(filter);
  const [{ count }] = await db<{ count: number }[]>`select count(*)::int as count from leads where ${where}`;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1) || 1), pages);
  const rows = await db<LeadRow[]>`select ${db.unsafe(COLUMNS)} from leads where ${where} order by created_at desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;
  return { rows: rows.map(toLead), total: count, page, pages };
}

export async function getLead(id: string): Promise<Lead | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [row] = await db<LeadRow[]>`select ${db.unsafe(COLUMNS)} from leads where id = ${id}`;
  return row ? toLead(row) : null;
}

export async function updateLead(id: string, patch: { status: LeadStatus; note: string }): Promise<boolean> {
  const rows = await sql()`update leads set status = ${patch.status}, note = ${patch.note}, updated_at = now() where id = ${id} returning id`;
  return rows.length > 0;
}

export async function deleteLead(id: string): Promise<boolean> {
  const rows = await sql()`delete from leads where id = ${id} returning id`;
  return rows.length > 0;
}

export async function leadStats(): Promise<{ total: number; fresh: number; week: number }> {
  const [row] = await sql()<{ total: number; fresh: number; week: number }[]>`
    select count(*)::int as total,
           count(*) filter (where status = 'new')::int as fresh,
           count(*) filter (where created_at > now() - interval '7 days')::int as week
    from leads`;
  return row;
}

export async function leadsForExport(filter: Pick<LeadFilter, "status" | "q">): Promise<Lead[]> {
  const db = sql();
  const rows = await db<LeadRow[]>`select ${db.unsafe(COLUMNS)} from leads where ${whereClause(filter)} order by created_at desc limit 10000`;
  return rows.map(toLead);
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}
