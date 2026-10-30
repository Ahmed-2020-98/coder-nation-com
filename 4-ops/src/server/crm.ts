import "server-only";
import { normalizePhone, type ActivityKind, type Currency, type Source, type Stage } from "@/lib/crm-rules";
import { validateTransition, type Transition } from "@/lib/crm-flow";
import { sql } from "./db";

export type DealSummary = {
  id: string;
  title: string;
  service: string | null;
  stage: Stage;
  source: Source;
  valueMinor: number | null;
  currency: Currency | null;
  ownerId: string | null;
  ownerName: string | null;
  clientId: string;
  clientName: string;
  openFollowUps: number;
  nextFollowUpAt: Date | null;
  stageChangedAt: Date;
  createdAt: Date;
};

export type DealDetail = DealSummary & {
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  lostReason: string | null;
  message: string | null;
  closedAt: Date | null;
};

type DealRow = {
  id: string;
  title: string;
  service: string | null;
  stage: Stage;
  source: Source;
  value_minor: string | null;
  currency: Currency | null;
  owner_id: string | null;
  owner_name: string | null;
  client_id: string;
  client_name: string;
  open_follow_ups: number;
  next_follow_up_at: Date | null;
  stage_changed_at: Date;
  created_at: Date;
};

const toSummary = (row: DealRow): DealSummary => ({
  id: row.id,
  title: row.title,
  service: row.service,
  stage: row.stage,
  source: row.source,
  valueMinor: row.value_minor === null ? null : Number(row.value_minor),
  currency: row.currency?.trim() as Currency | null,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  clientId: row.client_id,
  clientName: row.client_name,
  openFollowUps: row.open_follow_ups,
  nextFollowUpAt: row.next_follow_up_at,
  stageChangedAt: row.stage_changed_at,
  createdAt: row.created_at,
});

/** Shared SELECT: a deal with its client, owner and open follow-up count. */
function dealSelect() {
  const db = sql();
  return db`
    select d.id, d.title, d.service, d.stage, d.source, d.value_minor, d.currency, d.owner_id, u.name as owner_name,
           d.client_id, c.name as client_name, d.stage_changed_at, d.created_at,
           (select count(*)::int from follow_ups f where f.deal_id = d.id and f.done_at is null) as open_follow_ups,
           (select min(f.due_at) from follow_ups f where f.deal_id = d.id and f.done_at is null) as next_follow_up_at
    from deals d
    join clients c on c.id = d.client_id
    left join users u on u.id = d.owner_id`;
}

export type DealFilter = { ownerId?: string; q?: string };

/** Substring search over title and client name (strpos: `%` and `_` are plain characters). */
export async function listDeals(filter: DealFilter = {}): Promise<DealSummary[]> {
  const db = sql();
  const q = filter.q?.trim().slice(0, 100).toLowerCase();
  const rows = await db<DealRow[]>`
    select * from (${dealSelect()}) as d
    where true
      ${filter.ownerId ? db`and d.owner_id = ${filter.ownerId}` : db``}
      ${q ? db`and (strpos(lower(d.title), ${q}) > 0 or strpos(lower(d.client_name), ${q}) > 0)` : db``}
    order by d.stage_changed_at desc
    limit 500`;
  return rows.map(toSummary);
}

export async function getDeal(id: string): Promise<DealDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [row] = await db<
    (DealRow & {
      contact_id: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      contact_email: string | null;
      client_phone: string | null;
      client_email: string | null;
      lost_reason: string | null;
      message: string | null;
      closed_at: Date | null;
    })[]
  >`
    select s.*, d.contact_id, d.lost_reason, d.message, d.closed_at,
           c.phone as client_phone, c.email as client_email,
           ct.name as contact_name, ct.phone as contact_phone, ct.email as contact_email
    from (${dealSelect()}) as s
    join deals d on d.id = s.id
    join clients c on c.id = s.client_id
    left join contacts ct on ct.id = d.contact_id
    where s.id = ${id}`;
  if (!row) return null;
  return {
    ...toSummary(row),
    contactId: row.contact_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    lostReason: row.lost_reason,
    message: row.message,
    closedAt: row.closed_at,
  };
}

export type NewDeal = {
  title: string;
  service: string | null;
  source: Source;
  valueMinor: number | null;
  currency: Currency | null;
  ownerId: string | null;
  message: string | null;
  /** An existing client, or the details of a new one (matched by phone when there is one). */
  clientId?: string;
  client?: { name: string; phone: string | null; email: string | null };
  contact?: { name: string; phone: string | null; email: string | null } | null;
  externalId?: string | null;
};

type Tx = ReturnType<typeof sql>;

async function findOrCreateClient(tx: Tx, input: NonNullable<NewDeal["client"]>, createdBy: string | null): Promise<string> {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone) {
    const [existing] = await tx<{ id: string }[]>`select id from clients where phone = ${phone} order by created_at limit 1`;
    if (existing) return existing.id;
  }
  const [row] = await tx<{ id: string }[]>`
    insert into clients (name, phone, email, created_by) values (${input.name}, ${phone}, ${input.email}, ${createdBy}) returning id`;
  return row.id;
}

export async function createDeal(input: NewDeal, createdBy: string | null): Promise<{ id: string; created: boolean }> {
  return sql().begin(async (tx) => {
    if (input.externalId) {
      const [dup] = await tx<{ id: string }[]>`select id from deals where external_id = ${input.externalId}`;
      if (dup) return { id: dup.id, created: false };
    }
    const clientId = input.clientId ?? (await findOrCreateClient(tx as unknown as Tx, input.client!, createdBy));
    let contactId: string | null = null;
    if (input.contact) {
      const [contact] = await tx<{ id: string }[]>`
        insert into contacts (client_id, name, phone, email) values (${clientId}, ${input.contact.name}, ${input.contact.phone ? normalizePhone(input.contact.phone) : null}, ${input.contact.email})
        returning id`;
      contactId = contact.id;
    }
    const [deal] = await tx<{ id: string }[]>`
      insert into deals (client_id, contact_id, title, service, source, external_id, value_minor, currency, owner_id, message)
      values (${clientId}, ${contactId}, ${input.title}, ${input.service}, ${input.source}, ${input.externalId ?? null}, ${input.valueMinor}, ${input.currency}, ${input.ownerId}, ${input.message})
      returning id`;
    await tx`insert into activities (deal_id, user_id, kind, body) values (${deal.id}, ${createdBy}, 'system', ${input.source === "website" ? "وصلت من فورم الموقع" : "اتعملت الصفقة"})`;
    return { id: deal.id, created: true };
  });
}

export async function updateDealDetails(
  id: string,
  patch: { title: string; service: string | null; valueMinor: number | null; currency: Currency | null },
): Promise<boolean> {
  const rows = await sql()`
    update deals set title = ${patch.title}, service = ${patch.service}, value_minor = ${patch.valueMinor}, currency = ${patch.currency}, updated_at = now()
    where id = ${id} returning id`;
  return rows.length > 0;
}

export async function assignDeal(id: string, ownerId: string | null, byUserId: string): Promise<boolean> {
  const db = sql();
  return db.begin(async (tx) => {
    const rows = await tx`update deals set owner_id = ${ownerId}, updated_at = now() where id = ${id} returning id`;
    if (rows.length === 0) return false;
    const [owner] = ownerId ? await tx<{ name: string }[]>`select name from users where id = ${ownerId}` : [];
    await tx`insert into activities (deal_id, user_id, kind, body) values (${id}, ${byUserId}, 'system', ${owner ? `اتسندت لـ ${owner.name}` : "اتشال المسؤول عن الصفقة"})`;
    return true;
  });
}

export async function moveDeal(id: string, to: Stage, lostReason: string | null, byUserId: string): Promise<Transition> {
  const db = sql();
  return db.begin(async (tx): Promise<Transition> => {
    const [deal] = await tx<{ stage: Stage }[]>`select stage from deals where id = ${id} for update`;
    if (!deal) return { ok: false, error: "الصفقة مش موجودة" };
    const check = validateTransition(deal.stage, to, lostReason);
    if (!check.ok) return check;
    const closing = to === "won" || to === "lost";
    const reason = to === "lost" ? lostReason!.trim() : null;
    await tx`
      update deals set stage = ${to}, lost_reason = ${reason}, stage_changed_at = now(), updated_at = now(),
                       closed_at = ${closing ? tx`now()` : null}
      where id = ${id}`;
    const { STAGE_LABEL } = await import("@/lib/crm-rules");
    await tx`insert into activities (deal_id, user_id, kind, body)
             values (${id}, ${byUserId}, 'stage', ${`من «${STAGE_LABEL[deal.stage]}» إلى «${STAGE_LABEL[to]}»${reason ? `. السبب: ${reason}` : ""}`})`;
    return { ok: true };
  });
}

export type Activity = { id: string; kind: ActivityKind; body: string; userName: string | null; createdAt: Date };

export async function listActivities(dealId: string): Promise<Activity[]> {
  const rows = await sql()<{ id: string; kind: ActivityKind; body: string; name: string | null; created_at: Date }[]>`
    select a.id, a.kind, a.body, u.name, a.created_at from activities a left join users u on u.id = a.user_id
    where a.deal_id = ${dealId} order by a.created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body, userName: r.name, createdAt: r.created_at }));
}

export async function addActivity(dealId: string, userId: string, kind: ActivityKind, body: string): Promise<void> {
  await sql()`insert into activities (deal_id, user_id, kind, body) values (${dealId}, ${userId}, ${kind}, ${body})`;
  await sql()`update deals set updated_at = now() where id = ${dealId}`;
}

export type FollowUp = { id: string; dealId: string; dealTitle: string; clientName: string; assigneeName: string | null; dueAt: Date; note: string; doneAt: Date | null };

export async function listFollowUps(filter: { dealId?: string; assigneeId?: string; openOnly?: boolean; limit?: number }): Promise<FollowUp[]> {
  const db = sql();
  const rows = await db<
    { id: string; deal_id: string; title: string; client_name: string; assignee_name: string | null; due_at: Date; note: string; done_at: Date | null }[]
  >`
    select f.id, f.deal_id, d.title, c.name as client_name, u.name as assignee_name, f.due_at, f.note, f.done_at
    from follow_ups f join deals d on d.id = f.deal_id join clients c on c.id = d.client_id left join users u on u.id = f.assignee_id
    where true
      ${filter.dealId ? db`and f.deal_id = ${filter.dealId}` : db``}
      ${filter.assigneeId ? db`and (f.assignee_id = ${filter.assigneeId} or d.owner_id = ${filter.assigneeId})` : db``}
      ${filter.openOnly ? db`and f.done_at is null` : db``}
    order by f.done_at nulls first, f.due_at limit ${filter.limit ?? 100}`;
  return rows.map((r) => ({ id: r.id, dealId: r.deal_id, dealTitle: r.title, clientName: r.client_name, assigneeName: r.assignee_name, dueAt: r.due_at, note: r.note, doneAt: r.done_at }));
}

export async function addFollowUp(dealId: string, assigneeId: string | null, dueAt: Date, note: string): Promise<void> {
  await sql()`insert into follow_ups (deal_id, assignee_id, due_at, note) values (${dealId}, ${assigneeId}, ${dueAt}, ${note})`;
}

/** Marks a follow-up done; returns its deal id (for access checks and redirects), or null if it doesn't exist. */
export async function completeFollowUp(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql()<{ deal_id: string }[]>`update follow_ups set done_at = coalesce(done_at, now()) where id = ${id} returning deal_id`;
  return row?.deal_id ?? null;
}

export async function dealIdOfFollowUp(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql()<{ deal_id: string }[]>`select deal_id from follow_ups where id = ${id}`;
  return row?.deal_id ?? null;
}

export async function stageCounts(ownerId?: string): Promise<Record<Stage, number>> {
  const db = sql();
  const rows = await db<{ stage: Stage; n: number }[]>`select stage, count(*)::int as n from deals ${ownerId ? db`where owner_id = ${ownerId}` : db``} group by stage`;
  const counts = { new: 0, contacted: 0, meeting: 0, proposal_sent: 0, negotiation: 0, won: 0, lost: 0 } as Record<Stage, number>;
  for (const row of rows) counts[row.stage] = row.n;
  return counts;
}

export type ClientRow = { id: string; name: string; phone: string | null; email: string | null; website: string | null; notes: string; dealCount: number; createdAt: Date };

export async function listClients(q?: string): Promise<ClientRow[]> {
  const db = sql();
  const needle = q?.trim().slice(0, 100).toLowerCase();
  const digits = needle ? normalizePhone(needle) : "";
  const rows = await db<
    { id: string; name: string; phone: string | null; email: string | null; website: string | null; notes: string; deal_count: number; created_at: Date }[]
  >`
    select c.id, c.name, c.phone, c.email, c.website, c.notes, c.created_at, (select count(*)::int from deals d where d.client_id = c.id) as deal_count
    from clients c
    where true ${needle ? db`and (strpos(lower(c.name), ${needle}) > 0 or strpos(lower(coalesce(c.email, '')), ${needle}) > 0 or (${digits.length >= 3} and strpos(coalesce(c.phone, ''), ${digits}) > 0))` : db``}
    order by c.created_at desc limit 300`;
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, website: r.website, notes: r.notes, dealCount: r.deal_count, createdAt: r.created_at }));
}

export type ClientDetail = ClientRow & { contacts: { id: string; name: string; jobTitle: string | null; phone: string | null; email: string | null }[] };

export async function getClient(id: string): Promise<ClientDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [client] = await db<
    { id: string; name: string; phone: string | null; email: string | null; website: string | null; notes: string; deal_count: number; created_at: Date }[]
  >`
    select c.id, c.name, c.phone, c.email, c.website, c.notes, c.created_at, (select count(*)::int from deals d where d.client_id = c.id) as deal_count
    from clients c where c.id = ${id}`;
  if (!client) return null;
  const contacts = await db<{ id: string; name: string; job_title: string | null; phone: string | null; email: string | null }[]>`
    select id, name, job_title, phone, email from contacts where client_id = ${id} order by created_at`;
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    website: client.website,
    notes: client.notes,
    dealCount: client.deal_count,
    createdAt: client.created_at,
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, jobTitle: c.job_title, phone: c.phone, email: c.email })),
  };
}

export async function createClient(input: { name: string; phone: string | null; email: string | null; website: string | null; notes: string }, createdBy: string): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    insert into clients (name, phone, email, website, notes, created_by)
    values (${input.name}, ${input.phone ? normalizePhone(input.phone) : null}, ${input.email}, ${input.website}, ${input.notes}, ${createdBy}) returning id`;
  return row.id;
}

export async function updateClient(id: string, input: { name: string; phone: string | null; email: string | null; website: string | null; notes: string }): Promise<boolean> {
  const rows = await sql()`
    update clients set name = ${input.name}, phone = ${input.phone ? normalizePhone(input.phone) : null}, email = ${input.email}, website = ${input.website}, notes = ${input.notes}
    where id = ${id} returning id`;
  return rows.length > 0;
}

export async function addContact(clientId: string, input: { name: string; jobTitle: string | null; phone: string | null; email: string | null }): Promise<void> {
  await sql()`insert into contacts (client_id, name, job_title, phone, email) values (${clientId}, ${input.name}, ${input.jobTitle}, ${input.phone ? normalizePhone(input.phone) : null}, ${input.email})`;
}

export async function dealsOfClient(clientId: string): Promise<DealSummary[]> {
  const rows = await sql()<DealRow[]>`select * from (${dealSelect()}) as d where d.client_id = ${clientId} order by d.stage_changed_at desc`;
  return rows.map(toSummary);
}
