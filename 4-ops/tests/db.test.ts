import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { migrate } from "../db/migrate.mjs";

// Integration tests on a throw-away Postgres database (random name, dropped at the end; nothing else is touched).

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";
const DB_NAME = `cn_ops_test_${Math.random().toString(36).slice(2, 10)}`;
const CTX = { ipHash: "iphash-1", userAgent: "vitest" };

type Mods = {
  db: typeof import("@/server/db");
  auth: typeof import("@/server/auth-core");
  crm: typeof import("@/server/crm");
  proposals: typeof import("@/server/proposals");
  users: typeof import("@/server/users");
  password: typeof import("@/server/password");
  intake: typeof import("@/server/intake");
  tasks: typeof import("@/server/tasks");
  projects: typeof import("@/server/projects");
  attendance: typeof import("@/server/attendance");
};
const m = {} as Mods;
let raw: ReturnType<typeof postgres>;

beforeAll(async () => {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();
  process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  raw = postgres(process.env.DATABASE_URL, { max: 4, onnotice: () => {} });
  expect(await migrate(raw)).toEqual(["001_init.sql", "002_tasks.sql", "003_attendance.sql"]);
  expect(await migrate(raw)).toEqual([]);
  vi.resetModules();
  m.db = await import("@/server/db");
  m.auth = await import("@/server/auth-core");
  m.crm = await import("@/server/crm");
  m.proposals = await import("@/server/proposals");
  m.users = await import("@/server/users");
  m.password = await import("@/server/password");
  m.intake = await import("@/server/intake");
  m.tasks = await import("@/server/tasks");
  m.projects = await import("@/server/projects");
  m.attendance = await import("@/server/attendance");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await raw?.end({ timeout: 5 });
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${DB_NAME} with (force)`);
  await admin.end();
});

beforeEach(async () => {
  await raw`truncate users, sessions, rate_limits, clients, contacts, deals, activities, follow_ups, proposals, proposal_items, proposal_milestones, proposal_counters, projects, tasks, task_events, work_schedules, attendance, attendance_edits, leaves restart identity cascade`;
});

async function seedUser(email: string, role: "owner" | "manager" | "employee", extra: { active?: boolean; must?: boolean; password?: string } = {}) {
  const password = extra.password ?? "a long enough password";
  const [row] = await raw<{ id: string }[]>`
    insert into users (email, name, role, password_hash, active, must_change_password)
    values (${email}, ${email.split("@")[0] + " user"}, ${role}, ${await m.password.hashPassword(password)}, ${extra.active ?? true}, ${extra.must ?? false}) returning id`;
  return { id: row.id, email, password };
}

const newDeal = (over: Partial<Parameters<Mods["crm"]["createDeal"]>[0]> = {}) => ({
  title: "موقع شركة",
  service: "موقع إلكتروني",
  source: "manual" as const,
  valueMinor: null,
  currency: null,
  ownerId: null,
  message: null,
  client: { name: "شركة النور", phone: "+201000000001", email: null },
  ...over,
});

describe("accounts and sessions", () => {
  it("signs in an active user, returns the role, and stores only a hash of the token", async () => {
    const u = await seedUser("boss@x.com", "owner");
    const result = await m.auth.signIn(" BOSS@x.com ", u.password, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await m.auth.userFromToken(result.token)).toMatchObject({ id: u.id, role: "owner", mustChangePassword: false });
    expect(JSON.stringify(await raw`select token_hash from sessions`)).not.toContain(result.token);
  });

  it("a suspended account looks exactly like a wrong password, and its live sessions stop working", async () => {
    const owner = await seedUser("boss@x.com", "owner");
    const staff = await seedUser("emp@x.com", "employee");
    const session = await m.auth.signIn("emp@x.com", staff.password, CTX);
    if (!session.ok) throw new Error("sign-in failed");
    expect((await m.users.setActive(staff.id, false, owner.id)).ok).toBe(true);
    expect(await m.auth.userFromToken(session.token)).toBeNull();
    expect(await raw`select 1 from sessions where user_id = ${staff.id}`).toHaveLength(0);
    expect(await m.auth.signIn("emp@x.com", staff.password, { ipHash: "other", userAgent: null })).toEqual({ ok: false, reason: "invalid" });
    expect(await m.auth.signIn("emp@x.com", "wrong wrong wrong", { ipHash: "other2", userAgent: null })).toEqual({ ok: false, reason: "invalid" });
    await m.users.setActive(staff.id, true, owner.id);
    expect((await m.auth.signIn("emp@x.com", staff.password, { ipHash: "other3", userAgent: null })).ok).toBe(true);
  });

  it("locks after 5 failures even for the right password; unknown emails get the same answer", async () => {
    const u = await seedUser("boss@x.com", "owner");
    for (let i = 0; i < 5; i++) expect(await m.auth.signIn("boss@x.com", "bad bad bad bad", CTX)).toEqual({ ok: false, reason: "invalid" });
    expect(await m.auth.signIn("boss@x.com", u.password, CTX)).toMatchObject({ ok: false, reason: "limited" });
    expect(await m.auth.signIn("ghost@x.com", "whatever whatever", { ipHash: "fresh", userAgent: null })).toEqual({ ok: false, reason: "invalid" });
  });

  it("flags a temporary password, and changing it needs the old one and closes the other sessions", async () => {
    const u = await seedUser("emp@x.com", "employee", { must: true });
    const a = await m.auth.signIn("emp@x.com", u.password, { ipHash: "a", userAgent: null });
    const b = await m.auth.signIn("emp@x.com", u.password, { ipHash: "b", userAgent: null });
    if (!a.ok || !b.ok) throw new Error("sign-in failed");
    expect(a.mustChangePassword).toBe(true);
    expect(await m.auth.changePassword(u.id, "not the password", "a brand new passphrase", a.token)).toEqual({ ok: false, error: "الباسورد الحالي غلط" });
    expect((await m.auth.changePassword(u.id, u.password, "short", a.token)).ok).toBe(false);
    expect((await m.auth.changePassword(u.id, u.password, u.password, a.token)).ok).toBe(false);
    expect(await m.auth.changePassword(u.id, u.password, "a brand new passphrase", a.token)).toEqual({ ok: true });
    expect(await m.auth.userFromToken(a.token)).toMatchObject({ mustChangePassword: false });
    expect(await m.auth.userFromToken(b.token)).toBeNull();
    expect((await m.auth.signIn("emp@x.com", "a brand new passphrase", { ipHash: "c", userAgent: null })).ok).toBe(true);
  });

  it("team management: temp passwords, duplicate emails, and the last active owner can't be removed or demoted", async () => {
    const owner = await seedUser("boss@x.com", "owner");
    const made = await m.users.createUser({ email: "New@X.com", name: "موظف جديد", role: "employee" });
    expect(made.ok).toBe(true);
    const temporary = (made as { temporaryPassword: string }).temporaryPassword;
    expect(temporary).toHaveLength(18);
    const signedIn = await m.auth.signIn("new@x.com", temporary, CTX);
    expect(signedIn).toMatchObject({ ok: true, mustChangePassword: true });
    expect(await m.users.createUser({ email: "new@x.com", name: "تاني", role: "employee" })).toEqual({ ok: false, error: "الإيميل ده مسجّل قبل كده" });
    expect((await m.users.createUser({ email: "bad", name: "x y", role: "employee" })).ok).toBe(false);
    expect((await m.users.createUser({ email: "a@b.co", name: "x y", role: "root" as never })).ok).toBe(false);

    expect(await m.users.setActive(owner.id, false, owner.id)).toMatchObject({ ok: false });
    expect(await m.users.setRole(owner.id, "manager", owner.id)).toMatchObject({ ok: false });
    const second = await seedUser("boss2@x.com", "owner");
    expect(await m.users.setRole(owner.id, "manager", second.id)).toEqual({ ok: true });
    expect(await m.users.setRole(second.id, "employee", owner.id)).toMatchObject({ ok: false, error: expect.stringContaining("مالك") });
    expect(await m.users.setActive(second.id, false, owner.id)).toMatchObject({ ok: false });

    const reset = await m.users.resetPassword(second.id);
    expect(reset.ok).toBe(true);
    expect(await m.auth.signIn("boss2@x.com", second.password, { ipHash: "z", userAgent: null })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("CRM", () => {
  it("creates a deal with its client, reuses a client with the same phone, and logs the creation", async () => {
    const first = await m.crm.createDeal(newDeal(), null);
    const second = await m.crm.createDeal(newDeal({ title: "تطبيق", client: { name: "اسم مختلف", phone: "٠١٠٠٠٠٠٠٠٠١".replace(/^٠١/, "+٢٠١"), email: null } }), null);
    expect(first.created).toBe(true);
    expect(await raw`select count(*)::int as n from clients`).toEqual([{ n: 1 }]);
    const deal = await m.crm.getDeal(second.id);
    expect(deal).toMatchObject({ title: "تطبيق", stage: "new", clientName: "شركة النور" });
    expect((await m.crm.listActivities(first.id))[0]).toMatchObject({ kind: "system" });
  });

  it("intake is idempotent: the same external id gives the same deal and no duplicates", async () => {
    const lead = { externalId: "11111111-2222-3333-4444-555555555555", name: "منى حسن", phone: "+201000000002", email: "mona@example.com", service: "تطبيق موبايل", message: "عايزة تطبيق" };
    const a = await m.intake.ingestWebsiteLead(lead);
    const b = await m.intake.ingestWebsiteLead(lead);
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    expect(await raw`select count(*)::int as n from deals`).toEqual([{ n: 1 }]);
    expect(await m.crm.getDeal(a.id)).toMatchObject({ source: "website", stage: "new", service: "تطبيق موبايل", message: "عايزة تطبيق" });
    const parallel = await Promise.allSettled([1, 2, 3, 4].map(() => m.intake.ingestWebsiteLead({ ...lead, externalId: "99999999-aaaa-bbbb-cccc-dddddddddddd" })));
    expect(parallel.filter((r) => r.status === "fulfilled" && r.value.created)).toHaveLength(1);
    expect(await raw`select count(*)::int as n from deals`).toEqual([{ n: 2 }]);
  });

  it("moves stages with a log entry, requires a reason to lose, and reopens a closed deal", async () => {
    const user = await seedUser("boss@x.com", "owner");
    const { id } = await m.crm.createDeal(newDeal(), user.id);
    expect(await m.crm.moveDeal(id, "meeting", null, user.id)).toEqual({ ok: true });
    expect(await m.crm.moveDeal(id, "meeting", null, user.id)).toMatchObject({ ok: false });
    expect(await m.crm.moveDeal(id, "lost", "  ", user.id)).toMatchObject({ ok: false });
    expect(await m.crm.moveDeal(id, "lost", "السعر", user.id)).toEqual({ ok: true });
    expect(await m.crm.getDeal(id)).toMatchObject({ stage: "lost", lostReason: "السعر" });
    expect(await raw`select closed_at from deals where id = ${id}`).not.toEqual([{ closed_at: null }]);
    expect(await m.crm.moveDeal(id, "won", null, user.id)).toMatchObject({ ok: false });
    expect(await m.crm.moveDeal(id, "negotiation", null, user.id)).toEqual({ ok: true });
    expect(await m.crm.getDeal(id)).toMatchObject({ stage: "negotiation", lostReason: null, closedAt: null });
    expect((await m.crm.listActivities(id)).filter((a) => a.kind === "stage").length).toBe(3);
    expect(await m.crm.moveDeal("00000000-0000-0000-0000-000000000000", "won", null, user.id)).toMatchObject({ ok: false });
  });

  it("the database itself refuses a lost deal without a reason and a reason on a deal that isn't lost", async () => {
    const { id } = await m.crm.createDeal(newDeal(), null);
    await expect(raw`update deals set stage = 'lost', closed_at = now() where id = ${id}`).rejects.toThrow();
    await expect(raw`update deals set lost_reason = 'السعر' where id = ${id}`).rejects.toThrow();
    await expect(raw`update deals set stage = 'won' where id = ${id}`).rejects.toThrow();
  });

  it("assigns owners, scopes lists by owner, searches by substring, and counts stages", async () => {
    const a = await seedUser("a@x.com", "employee");
    const b = await seedUser("b@x.com", "employee");
    const d1 = await m.crm.createDeal(newDeal({ title: "100% خصم", ownerId: a.id }), null);
    const d2 = await m.crm.createDeal(newDeal({ title: "متجر", client: { name: "شركة تانية", phone: "+201000000009", email: null }, ownerId: b.id }), null);
    expect((await m.crm.listDeals({ ownerId: a.id })).map((d) => d.id)).toEqual([d1.id]);
    expect((await m.crm.listDeals({ q: "%" })).map((d) => d.id)).toEqual([d1.id]);
    expect((await m.crm.listDeals({ q: "تانية" })).map((d) => d.id)).toEqual([d2.id]);
    expect(await m.crm.assignDeal(d1.id, b.id, a.id)).toBe(true);
    expect((await m.crm.listDeals({ ownerId: b.id })).length).toBe(2);
    expect(await m.crm.assignDeal("00000000-0000-0000-0000-000000000000", b.id, a.id)).toBe(false);
    await m.crm.moveDeal(d2.id, "won", null, a.id);
    expect(await m.crm.stageCounts()).toMatchObject({ new: 1, won: 1, lost: 0 });
    expect(await m.crm.stageCounts(a.id)).toMatchObject({ new: 0, won: 0 });
  });

  it("follow-ups: scheduled, listed for the assignee or deal owner, completed once", async () => {
    const u = await seedUser("a@x.com", "employee");
    const { id } = await m.crm.createDeal(newDeal({ ownerId: u.id }), null);
    await m.crm.addFollowUp(id, u.id, new Date(Date.now() + 86_400_000), "كلّمه");
    await m.crm.addFollowUp(id, u.id, new Date(Date.now() - 86_400_000), "متأخرة");
    const open = await m.crm.listFollowUps({ openOnly: true, assigneeId: u.id });
    expect(open.map((f) => f.note)).toEqual(["متأخرة", "كلّمه"]);
    expect(await m.crm.completeFollowUp(open[0].id)).toBe(id);
    expect((await m.crm.listFollowUps({ openOnly: true })).map((f) => f.note)).toEqual(["كلّمه"]);
    expect(await m.crm.completeFollowUp("nope")).toBeNull();
    expect(await m.crm.dealIdOfFollowUp(open[1].id)).toBe(id);
  });

  it("clients and contacts: create, edit, normalized phone, search by digits", async () => {
    const u = await seedUser("a@x.com", "manager");
    const clientId = await m.crm.createClient({ name: "شركة الأمل", phone: "٠١٠ ١٢٣ ٤٥٦٧", email: null, website: null, notes: "" }, u.id);
    await m.crm.addContact(clientId, { name: "أحمد", jobTitle: "مدير", phone: "+20 100 000 0003", email: "a@b.co" });
    const client = await m.crm.getClient(clientId);
    expect(client).toMatchObject({ phone: "0101234567", contacts: [{ name: "أحمد", phone: "+201000000003" }] });
    expect((await m.crm.listClients("101234")).map((c) => c.id)).toEqual([clientId]);
    expect((await m.crm.listClients("%")).length).toBe(0);
    expect(await m.crm.updateClient(clientId, { name: "شركة الأمل 2", phone: null, email: null, website: null, notes: "x" })).toBe(true);
    expect((await m.crm.getClient(clientId))?.name).toBe("شركة الأمل 2");
    expect(await m.crm.getClient("not-a-uuid")).toBeNull();
  });
});

describe("proposals", () => {
  async function setup() {
    const user = await seedUser("boss@x.com", "owner");
    const { id: dealId } = await m.crm.createDeal(newDeal({ currency: "USD", valueMinor: 500000 }), user.id);
    const proposalId = (await m.proposals.createProposalForDeal(dealId, user.id)) as string;
    return { user, dealId, proposalId };
  }
  const validInput = (over: Record<string, unknown> = {}) => {
    const parsed = m.proposals.parseProposalInput({
      title: "عرض الموقع",
      currency: "EGP",
      taxPercent: "14",
      discount: "1,000",
      validUntil: "2026-12-31",
      intro: "مرحبًا",
      items: [
        { title: "تصميم", description: "", quantity: 1, price: "10,000" },
        { title: "برمجة", description: "صفحات", quantity: "2", price: "7500.50" },
      ],
      milestones: [{ title: "مقدم", percent: "40" }, { title: "تسليم", percent: "60" }],
      sections: [{ title: "نظرة عامة", body: "نص" }],
      timeline: [{ title: "تنفيذ", weeks: "4" }],
      ...over,
    });
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.data;
  };

  it("creates a numbered draft from the deal (template sections, deal currency) and logs it", async () => {
    const { dealId, proposalId } = await setup();
    const proposal = await m.proposals.getProposal(proposalId);
    expect(proposal).toMatchObject({ status: "draft", currency: "USD", dealId, clientName: "شركة النور", items: [] });
    expect(proposal?.number).toBe(`P-${new Date().getFullYear()}-0001`);
    expect(proposal?.sections.length).toBeGreaterThan(3);
    expect(proposal?.milestones.reduce((s, x) => s + x.percentBp, 0)).toBe(10000);
    expect((await m.crm.listActivities(dealId)).some((a) => a.body.includes(proposal!.number))).toBe(true);
  });

  it("numbers never repeat, even when created in parallel", async () => {
    const { user, dealId } = await setup();
    const ids = await Promise.all(Array.from({ length: 12 }, () => m.proposals.createProposalForDeal(dealId, user.id)));
    const numbers = (await m.proposals.listProposals()).map((p) => p.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toHaveLength(13);
    expect(ids.every(Boolean)).toBe(true);
    expect([...numbers].sort()[12]).toBe(`P-${new Date().getFullYear()}-0013`);
  });

  it("parses what the editor sends and rejects bad numbers with a helpful message", () => {
    const data = validInput();
    expect(data).toMatchObject({ currency: "EGP", taxRateBp: 1400, discountMinor: 100000, validUntil: "2026-12-31" });
    expect(data.items.map((i) => i.unitPriceMinor)).toEqual([1_000_000, 750_050]);
    expect(data.milestones.map((x) => x.percentBp)).toEqual([4000, 6000]);
    expect(validInput({ taxPercent: "", discount: "" })).toMatchObject({ taxRateBp: null, discountMinor: 0 });
    const bad = (over: Record<string, unknown>) => m.proposals.parseProposalInput({ ...data, items: [{ title: "x", description: "", quantity: 1, price: "1" }], taxPercent: "", discount: "", milestones: [], sections: [], timeline: [], validUntil: "", intro: "", ...over });
    expect(bad({ currency: "XXX" })).toMatchObject({ ok: false });
    expect(bad({ items: [{ title: "x", description: "", quantity: 1, price: "abc" }] })).toMatchObject({ ok: false, error: expect.stringContaining("سعر البند 1") });
    expect(bad({ items: [{ title: "x", description: "", quantity: 0, price: "1" }] })).toMatchObject({ ok: false });
    expect(bad({ taxPercent: "140" })).toMatchObject({ ok: false });
    expect(bad({ discount: "-5" })).toMatchObject({ ok: false });
    expect(bad({ validUntil: "tomorrow" })).toMatchObject({ ok: false });
    expect(bad({ milestones: [{ title: "x", percent: "0" }] })).toMatchObject({ ok: false });
  });

  it("saves replacing items and payments, keeps exact prices, and is blocked once sent", async () => {
    const { user, proposalId, dealId } = await setup();
    expect(await m.proposals.saveProposal(proposalId, validInput())).toEqual({ ok: true });
    const saved = await m.proposals.getProposal(proposalId);
    expect(saved?.items).toHaveLength(2);
    expect(saved?.items[1]).toMatchObject({ title: "برمجة", quantity: 2, unitPriceMinor: 750_050 });
    expect(await m.proposals.saveProposal(proposalId, validInput({ items: [{ title: "واحد", description: "", quantity: 1, price: "5" }] }))).toEqual({ ok: true });
    expect((await m.proposals.getProposal(proposalId))?.items).toHaveLength(1);

    expect(await m.proposals.saveProposal(proposalId, validInput())).toEqual({ ok: true });
    expect(await m.proposals.markSent(proposalId, user.id)).toEqual({ ok: true });
    expect(await m.proposals.saveProposal(proposalId, validInput({ title: "تعديل بعد الإرسال" }))).toMatchObject({ ok: false });
    expect((await m.proposals.getProposal(proposalId))?.title).toBe("عرض الموقع");
    expect(await m.proposals.markSent(proposalId, user.id)).toMatchObject({ ok: false });
    expect(await m.crm.getDeal(dealId)).toMatchObject({ stage: "proposal_sent" });
  });

  it("won't mark an incomplete proposal as sent (no items, payments not 100%)", async () => {
    const { user, proposalId } = await setup();
    expect(await m.proposals.markSent(proposalId, user.id)).toMatchObject({ ok: false });
    await m.proposals.saveProposal(proposalId, validInput({ milestones: [{ title: "مقدم", percent: "40" }] }));
    expect(await m.proposals.markSent(proposalId, user.id)).toMatchObject({ ok: false, error: expect.stringContaining("100%") });
    expect((await m.proposals.getProposal(proposalId))?.status).toBe("draft");
  });

  it("sending moves the deal forward only: an earlier stage advances, a later one stays, a closed one stays", async () => {
    const { user } = await setup();
    for (const [stage, expected] of [["new", "proposal_sent"], ["meeting", "proposal_sent"], ["negotiation", "negotiation"], ["won", "won"]] as const) {
      const { id: dealId } = await m.crm.createDeal(newDeal({ client: { name: `عميل ${stage}`, phone: null, email: null } }), user.id);
      if (stage !== "new") await m.crm.moveDeal(dealId, stage, null, user.id);
      const proposalId = (await m.proposals.createProposalForDeal(dealId, user.id)) as string;
      await m.proposals.saveProposal(proposalId, validInput());
      expect(await m.proposals.markSent(proposalId, user.id)).toEqual({ ok: true });
      expect((await m.crm.getDeal(dealId))?.stage, stage).toBe(expected);
    }
  });

  it("records accepted/rejected only for sent proposals, and duplicates into a fresh editable draft", async () => {
    const { user, proposalId } = await setup();
    expect(await m.proposals.setOutcome(proposalId, "accepted", user.id)).toMatchObject({ ok: false });
    await m.proposals.saveProposal(proposalId, validInput());
    await m.proposals.markSent(proposalId, user.id);
    expect(await m.proposals.setOutcome(proposalId, "accepted", user.id)).toEqual({ ok: true });
    expect(await m.proposals.setOutcome(proposalId, "rejected", user.id)).toMatchObject({ ok: false });

    const copyId = (await m.proposals.duplicateProposal(proposalId, user.id)) as string;
    const [original, copy] = await Promise.all([m.proposals.getProposal(proposalId), m.proposals.getProposal(copyId)]);
    expect(copy).toMatchObject({ status: "draft", title: original?.title, sentAt: null });
    expect(copy?.number).not.toBe(original?.number);
    expect(copy?.items).toEqual(original?.items);
    expect(copy?.milestones).toEqual(original?.milestones);
    expect(await m.proposals.saveProposal(copyId, validInput({ title: "نسخة معدّلة" }))).toEqual({ ok: true });
    expect((await m.proposals.getProposal(proposalId))?.title).toBe("عرض الموقع");
  });

  it("accepting a proposal sets the deal's value and currency to its total; rejecting leaves them alone", async () => {
    const { user, proposalId, dealId } = await setup();
    await m.proposals.saveProposal(proposalId, validInput());
    await m.proposals.markSent(proposalId, user.id);
    expect(await m.proposals.setOutcome(proposalId, "rejected", user.id)).toEqual({ ok: true });
    expect(await m.crm.getDeal(dealId)).toMatchObject({ valueMinor: 500000, currency: "USD" });

    const other = (await m.proposals.createProposalForDeal(dealId, user.id)) as string;
    await m.proposals.saveProposal(other, validInput({ currency: "SAR" }));
    await m.proposals.markSent(other, user.id);
    expect(await m.proposals.setOutcome(other, "accepted", user.id)).toEqual({ ok: true });
    // subtotal 25,001.00 - 1,000.00 discount + 14% tax = 27,361.14
    expect(await m.crm.getDeal(dealId)).toMatchObject({ valueMinor: 27_361_14, currency: "SAR" });
  });

  it("lists proposals with totals that include discount and tax", async () => {
    const { proposalId } = await setup();
    await m.proposals.saveProposal(proposalId, validInput());
    const [row] = await m.proposals.listProposals();
    // subtotal 10,000 + 2 x 7,500.50 = 25,001.00 ; minus 1,000 = 24,001.00 ; +14% = 27,361.14
    expect(row.totalMinor).toBe(27_361_14);
    expect(row.id).toBe(proposalId);
    expect((await m.proposals.listProposals("00000000-0000-0000-0000-000000000000"))).toEqual([]);
  });
});

describe("tasks and projects", () => {
  async function wonDealWithProposal(userId: string, timeline = [{ title: "تحليل", weeks: "2" }, { title: "تنفيذ", weeks: "4" }]) {
    const { id: dealId } = await m.crm.createDeal(newDeal(), userId);
    const proposalId = (await m.proposals.createProposalForDeal(dealId, userId)) as string;
    const parsed = m.proposals.parseProposalInput({
      title: "عرض",
      currency: "EGP",
      taxPercent: "",
      discount: "",
      validUntil: "",
      intro: "",
      items: [{ title: "بند", description: "", quantity: 1, price: "100" }],
      milestones: [{ title: "دفعة", percent: "100" }],
      sections: [],
      timeline,
    });
    if (!parsed.ok) throw new Error(parsed.error);
    await m.proposals.saveProposal(proposalId, parsed.data);
    await m.proposals.markSent(proposalId, userId);
    await m.crm.moveDeal(dealId, "won", null, userId);
    return { dealId, proposalId };
  }
  const newTask = (over: Partial<Parameters<Mods["tasks"]["createTask"]>[0]> = {}) => ({
    title: "مهمة",
    description: "",
    priority: "normal" as const,
    assigneeId: null,
    dueDate: null,
    projectId: null,
    dealId: null,
    clientId: null,
    ...over,
  });

  it("starts a project from a won deal: one task per proposal phase, due dates counted from the start", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const { dealId, proposalId } = await wonDealWithProposal(boss.id);
    const result = await m.projects.startProjectFromDeal(dealId, "2026-01-01", boss.id);
    expect(result).toMatchObject({ ok: true, tasks: 2 });
    if (!result.ok) return;
    const project = await m.projects.getProject(result.id);
    expect(project).toMatchObject({ name: "موقع شركة", clientName: "شركة النور", dealId, proposalId, startDate: "2026-01-01", dueDate: "2026-02-11", status: "active", totalTasks: 2 });
    const tasks = await m.tasks.listTasks({ projectId: result.id });
    expect(tasks.map((t) => [t.title, t.dueDate, t.status]).sort()).toEqual([["تحليل", "2026-01-14", "todo"], ["تنفيذ", "2026-02-11", "todo"]]);
    expect((await m.projects.projectOfDeal(dealId)).map((p) => p.id)).toEqual([result.id]);
    expect((await m.crm.listActivities(dealId)).some((a) => a.body.includes("اتبدأ المشروع"))).toBe(true);
  });

  it("refuses a second project from the same proposal, and a project from a deal that isn't won", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const { dealId } = await wonDealWithProposal(boss.id);
    expect(await m.projects.startProjectFromDeal(dealId, "2026-01-01", boss.id)).toMatchObject({ ok: true });
    expect(await m.projects.startProjectFromDeal(dealId, "2026-01-01", boss.id)).toMatchObject({ ok: false, error: expect.stringContaining("قبل كده") });
    // two clicks at the same moment still make one project
    const { dealId: other } = await wonDealWithProposal(boss.id);
    const both = await Promise.all([m.projects.startProjectFromDeal(other, "2026-03-01", boss.id), m.projects.startProjectFromDeal(other, "2026-03-01", boss.id)]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(await raw`select 1 from projects`).toHaveLength(2);

    const { id: openDeal } = await m.crm.createDeal(newDeal({ client: { name: "عميل تاني", phone: null, email: null } }), boss.id);
    expect(await m.projects.startProjectFromDeal(openDeal, "2026-01-01", boss.id)).toMatchObject({ ok: false });
    expect(await m.projects.startProjectFromDeal("00000000-0000-0000-0000-000000000000", "2026-01-01", boss.id)).toMatchObject({ ok: false });
  });

  it("a won deal without a proposal starts an empty project", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const { id: dealId } = await m.crm.createDeal(newDeal(), boss.id);
    await m.crm.moveDeal(dealId, "won", null, boss.id);
    const result = await m.projects.startProjectFromDeal(dealId, "2026-01-01", boss.id);
    expect(result).toMatchObject({ ok: true, tasks: 0 });
    if (result.ok) expect(await m.projects.getProject(result.id)).toMatchObject({ proposalId: null, dueDate: null, totalTasks: 0 });
  });

  it("the database itself rejects a blocked task without a reason and a done task without a completion time", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    await expect(raw`insert into tasks (title, status, created_by) values ('x', 'blocked', ${boss.id})`).rejects.toThrow();
    await expect(raw`insert into tasks (title, status, created_by) values ('x', 'done', ${boss.id})`).rejects.toThrow();
    await expect(raw`insert into tasks (title, status, blocked_reason, created_by) values ('x', 'todo', 'why', ${boss.id})`).rejects.toThrow();
    await expect(raw`insert into projects (name, status, start_date, created_by) values ('p', 'done', '2026-01-01', ${boss.id})`).rejects.toThrow();
  });

  it("changes status under the role rules, keeps completed_at and blocked_reason in step, and logs every move", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const dev = await seedUser("dev@x.com", "employee");
    const id = await m.tasks.createTask(newTask({ assigneeId: dev.id }), boss.id);
    const asDev = { id: dev.id, role: "employee" as const };
    const asBoss = { id: boss.id, role: "owner" as const };

    expect(await m.tasks.changeStatus(id, "doing", null, asDev)).toEqual({ ok: true });
    expect(await m.tasks.changeStatus(id, "blocked", null, asDev)).toMatchObject({ ok: false });
    expect(await m.tasks.changeStatus(id, "blocked", "مستني الدومين", asDev)).toEqual({ ok: true });
    expect(await m.tasks.getTask(id)).toMatchObject({ status: "blocked", blockedReason: "مستني الدومين" });
    expect(await m.tasks.changeStatus(id, "review", null, asDev)).toEqual({ ok: true });
    expect((await m.tasks.getTask(id))?.blockedReason).toBeNull();
    expect(await m.tasks.changeStatus(id, "done", null, asDev)).toMatchObject({ ok: false });
    expect((await m.tasks.getTask(id))?.completedAt).toBeNull();

    expect(await m.tasks.changeStatus(id, "done", null, asBoss)).toEqual({ ok: true });
    expect((await m.tasks.getTask(id))?.completedAt).toBeInstanceOf(Date);
    expect(await m.tasks.changeStatus(id, "doing", null, asDev)).toMatchObject({ ok: false });
    expect(await m.tasks.changeStatus(id, "doing", null, asBoss)).toEqual({ ok: true });
    expect(await m.tasks.getTask(id)).toMatchObject({ status: "doing", completedAt: null });
    expect(await m.tasks.changeStatus("00000000-0000-0000-0000-000000000000", "doing", null, asBoss)).toMatchObject({ ok: false });

    const events = await m.tasks.listEvents(id);
    expect(events.filter((e) => e.kind === "status")).toHaveLength(5);
    expect(events.some((e) => e.kind === "status" && e.body.includes("مستني الدومين"))).toBe(true);
  });

  it("assigns, comments, and edits a task", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const dev = await seedUser("dev@x.com", "employee");
    const id = await m.tasks.createTask(newTask({ title: "قديم" }), boss.id);
    expect(await m.tasks.assignTask(id, dev.id, boss.id)).toBe(true);
    expect(await m.tasks.assignTask("00000000-0000-0000-0000-000000000000", dev.id, boss.id)).toBe(false);
    expect((await m.tasks.getTask(id))?.assigneeName).toBe("dev user");
    await m.tasks.addComment(id, dev.id, "بدأت الشغل");
    expect(await m.tasks.updateTaskDetails(id, { title: "جديد", description: "وصف", priority: "urgent", dueDate: "2026-05-05", projectId: null, dealId: null, clientId: null })).toBe(true);
    expect(await m.tasks.getTask(id)).toMatchObject({ title: "جديد", priority: "urgent", dueDate: "2026-05-05" });
    expect((await m.tasks.listEvents(id)).map((e) => e.kind).sort()).toEqual(["assign", "comment", "system"]);
    expect(await m.tasks.getTask("not-a-uuid")).toBeNull();
  });

  it("lists tasks by assignee, overdue (Cairo day), search, and hides old finished ones", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const dev = await seedUser("dev@x.com", "employee");
    const other = await seedUser("other@x.com", "employee");
    const past = "2020-01-01";
    const future = "2099-01-01";
    const late = await m.tasks.createTask(newTask({ title: "متأخرة", assigneeId: dev.id, dueDate: past }), boss.id);
    await m.tasks.createTask(newTask({ title: "قدام", assigneeId: dev.id, dueDate: future }), boss.id);
    await m.tasks.createTask(newTask({ title: "بتاعة زميل", assigneeId: other.id, dueDate: past }), boss.id);
    const finished = await m.tasks.createTask(newTask({ title: "خلصت من زمان", assigneeId: dev.id, dueDate: past }), boss.id);
    await m.tasks.changeStatus(finished, "done", null, { id: boss.id, role: "owner" });
    await raw`update tasks set completed_at = now() - interval '30 days' where id = ${finished}`;

    expect((await m.tasks.listTasks({ assigneeId: dev.id })).map((t) => t.title).sort()).toEqual(["خلصت من زمان", "قدام", "متأخرة"].sort());
    expect((await m.tasks.listTasks({ assigneeId: dev.id, doneWithinDays: 14 })).map((t) => t.title).sort()).toEqual(["قدام", "متأخرة"].sort());
    expect((await m.tasks.listTasks({ overdueOnly: true })).map((t) => t.title).sort()).toEqual(["بتاعة زميل", "متأخرة"].sort());
    expect((await m.tasks.listTasks({ q: "قدا" })).map((t) => t.title)).toEqual(["قدام"]);
    expect(await m.tasks.taskCounts(dev.id)).toEqual({ open: 2, overdue: 1 });
    expect(await m.tasks.taskCounts()).toEqual({ open: 3, overdue: 2 });
    expect((await m.tasks.getTask(late))?.assigneeName).toBe("dev user");
  });

  it("an employee's project list holds only projects where they have a task", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const dev = await seedUser("dev@x.com", "employee");
    const mine = await m.projects.createProject({ name: "مشروعي", clientId: null, managerId: boss.id, startDate: "2026-01-01", dueDate: null, notes: "" }, boss.id);
    await m.projects.createProject({ name: "مشروع تاني", clientId: null, managerId: boss.id, startDate: "2026-01-01", dueDate: null, notes: "" }, boss.id);
    await m.tasks.createTask(newTask({ assigneeId: dev.id, projectId: mine }), boss.id);
    expect((await m.projects.listProjects({ memberId: dev.id })).map((p) => p.name)).toEqual(["مشروعي"]);
    expect(await m.projects.listProjects()).toHaveLength(2);
    // counts for an employee cover only their own tasks, not colleagues'
    const colleague = await seedUser("colleague@x.com", "employee");
    await m.tasks.createTask(newTask({ assigneeId: colleague.id, projectId: mine }), boss.id);
    expect((await m.projects.listProjects({ memberId: dev.id }))[0]).toMatchObject({ totalTasks: 1, doneTasks: 0 });
    expect(await m.projects.getProject(mine, dev.id)).toMatchObject({ totalTasks: 1 });
    expect(await m.projects.getProject(mine)).toMatchObject({ totalTasks: 2 });
    expect(await m.projects.userHasTaskIn(mine, dev.id)).toBe(true);
    expect(await m.projects.userHasTaskIn(mine, boss.id)).toBe(false);
  });

  it("closing a project sets closed_at and reopening clears it", async () => {
    const boss = await seedUser("boss@x.com", "owner");
    const id = await m.projects.createProject({ name: "مشروع", clientId: null, managerId: null, startDate: "2026-01-01", dueDate: null, notes: "" }, boss.id);
    const base = { name: "مشروع", clientId: null, managerId: null, startDate: "2026-01-01", dueDate: null, notes: "" };
    expect(await m.projects.updateProject(id, { ...base, status: "done" })).toBe(true);
    const [closed] = await raw<{ closed_at: Date | null }[]>`select closed_at from projects where id = ${id}`;
    expect(closed.closed_at).toBeInstanceOf(Date);
    expect(await m.projects.updateProject(id, { ...base, status: "active" })).toBe(true);
    const [reopened] = await raw<{ closed_at: Date | null }[]>`select closed_at from projects where id = ${id}`;
    expect(reopened.closed_at).toBeNull();
  });
});

describe("attendance", () => {
  // March is UTC+2 in Cairo: 07:00Z = 09:00 on the office clock.
  const at = (day: string, hh: number, mm = 0) => new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const shift = { startTime: "09:00", endTime: "17:00", workDays: [0, 1, 2, 3, 4], graceMinutes: 15 };

  async function tracked(email = "dev@x.com") {
    const user = await seedUser(email, "employee");
    expect(await m.attendance.saveSchedule(user.id, shift)).toEqual({ ok: true });
    return user;
  }

  it("saves a shift (create, then change), and refuses a shift that ends before it starts or for an unknown person", async () => {
    const user = await seedUser("dev@x.com", "employee");
    expect(await m.attendance.getSchedule(user.id)).toBeNull();
    expect(await m.attendance.saveSchedule(user.id, shift)).toEqual({ ok: true });
    const first = await m.attendance.getSchedule(user.id);
    expect(first).toMatchObject({ startTime: "09:00", endTime: "17:00", workDays: [0, 1, 2, 3, 4], graceMinutes: 15 });
    expect(await m.attendance.saveSchedule(user.id, { ...shift, startTime: "10:00", endTime: "18:00", workDays: [6, 0] })).toEqual({ ok: true });
    expect(await m.attendance.getSchedule(user.id)).toMatchObject({ startTime: "10:00", workDays: [0, 6], trackedSince: first?.trackedSince });
    expect(await m.attendance.saveSchedule(user.id, { ...shift, startTime: "17:00", endTime: "09:00" })).toMatchObject({ ok: false });
    expect(await m.attendance.saveSchedule("00000000-0000-0000-0000-000000000000", shift)).toMatchObject({ ok: false });
    const off = await seedUser("off@x.com", "employee", { active: false });
    expect(await m.attendance.saveSchedule(off.id, shift)).toMatchObject({ ok: false });
    await expect(raw`update work_schedules set work_days = '{7}' where user_id = ${user.id}`).rejects.toThrow();
    expect(await m.attendance.removeSchedule(user.id)).toBe(true);
    expect(await m.attendance.removeSchedule(user.id)).toBe(false);
  });

  it("checks in once a day by the server clock on the Cairo calendar, and records lateness", async () => {
    const user = await tracked();
    expect(await m.attendance.checkIn(user.id, at("2026-03-10", 7, 10))).toEqual({ ok: true });
    expect(await m.attendance.checkIn(user.id, at("2026-03-10", 7, 40))).toEqual({ ok: false, error: "سجّلت حضورك النهارده بالفعل" });
    const [first] = await m.attendance.recordsBetween(user.id, "2026-03-10", "2026-03-10");
    expect(first).toMatchObject({ workDate: "2026-03-10", lateMinutes: 0, checkOut: null });
    // 09:40 Cairo: 40 minutes after the start, past the 15-minute grace
    expect(await m.attendance.checkIn(user.id, at("2026-03-11", 7, 40))).toEqual({ ok: true });
    expect((await m.attendance.recordsBetween(user.id, "2026-03-11", "2026-03-11"))[0].lateMinutes).toBe(40);
    // 23:30 UTC is already the next day in Cairo
    expect(await m.attendance.checkIn(user.id, at("2026-03-11", 23, 30))).toEqual({ ok: true });
    expect((await m.attendance.recordsBetween(user.id, "2026-03-12", "2026-03-12"))).toHaveLength(1);
  });

  it("turning up on a rest day is never late, and a manager's entry for a rest day isn't either", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const user = await tracked();
    // 2026-03-13 is a Friday (rest day for Sun-Thu); 12:00 Cairo is 3 hours after the shift start
    expect(await m.attendance.checkIn(user.id, at("2026-03-13", 10))).toEqual({ ok: true });
    expect((await m.attendance.recordsBetween(user.id, "2026-03-13", "2026-03-13"))[0].lateMinutes).toBe(0);
    expect(await m.attendance.saveRecord({ userId: user.id, date: "2026-03-14", checkInTime: "12:00", checkOutTime: null, reason: "عطلة" }, boss.id)).toEqual({ ok: true });
    expect((await m.attendance.recordsBetween(user.id, "2026-03-14", "2026-03-14"))[0].lateMinutes).toBe(0);
    // ...but a working day (Sunday the 15th) at the same time is late
    await m.attendance.saveRecord({ userId: user.id, date: "2026-03-15", checkInTime: "12:00", checkOutTime: null, reason: "عمل" }, boss.id);
    expect((await m.attendance.recordsBetween(user.id, "2026-03-15", "2026-03-15"))[0].lateMinutes).toBe(180);
  });

  it("two check-ins at the same moment make one record", async () => {
    const user = await tracked();
    const results = await Promise.all([m.attendance.checkIn(user.id, at("2026-03-10", 7)), m.attendance.checkIn(user.id, at("2026-03-10", 7))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await raw`select 1 from attendance`).toHaveLength(1);
  });

  it("someone without a shift can't check in", async () => {
    const user = await seedUser("free@x.com", "employee");
    expect(await m.attendance.checkIn(user.id, at("2026-03-10", 7))).toMatchObject({ ok: false, error: expect.stringContaining("وردية") });
    expect(await raw`select 1 from attendance`).toHaveLength(0);
  });

  it("checks out once, only after checking in, and never before the check-in", async () => {
    const user = await tracked();
    expect(await m.attendance.checkOut(user.id, at("2026-03-10", 14))).toEqual({ ok: false, error: "سجّل حضورك الأول" });
    await m.attendance.checkIn(user.id, at("2026-03-10", 7));
    expect(await m.attendance.checkOut(user.id, at("2026-03-10", 6))).toMatchObject({ ok: false });
    expect(await m.attendance.checkOut(user.id, at("2026-03-10", 15))).toEqual({ ok: true });
    expect(await m.attendance.checkOut(user.id, at("2026-03-10", 16))).toEqual({ ok: false, error: "سجّلت انصرافك بالفعل" });
    expect((await m.attendance.recordsBetween(user.id, "2026-03-10", "2026-03-10"))[0].checkOut).toEqual(at("2026-03-10", 15));
    await expect(raw`update attendance set check_out = check_in where user_id = ${user.id}`).rejects.toThrow();
  });

  it("a manager's fix writes the record with Cairo times, recomputes lateness, and leaves a trail", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const user = await tracked();
    const created = await m.attendance.saveRecord({ userId: user.id, date: "2026-03-09", checkInTime: "09:30", checkOutTime: "17:00", reason: "نسي يسجّل" }, boss.id);
    expect(created).toEqual({ ok: true });
    const [record] = await m.attendance.recordsBetween(user.id, "2026-03-09", "2026-03-09");
    expect(record).toMatchObject({ lateMinutes: 30, checkIn: at("2026-03-09", 7, 30), checkOut: at("2026-03-09", 15) });

    expect(await m.attendance.saveRecord({ userId: user.id, date: "2026-03-09", checkInTime: "09:00", checkOutTime: null, reason: "تصحيح" }, boss.id)).toEqual({ ok: true });
    expect(await m.attendance.recordsBetween(user.id, "2026-03-09", "2026-03-09")).toMatchObject([{ lateMinutes: 0, checkOut: null }]);
    expect(await m.attendance.saveRecord({ userId: user.id, date: "2026-03-09", checkInTime: "10:00", checkOutTime: "09:00", reason: "غلط" }, boss.id)).toMatchObject({ ok: false });
    expect(await m.attendance.saveRecord({ userId: user.id, date: "2999-01-01", checkInTime: "09:00", checkOutTime: null, reason: "مستقبل" }, boss.id)).toMatchObject({ ok: false });
    expect(await m.attendance.saveRecord({ userId: "00000000-0000-0000-0000-000000000000", date: "2026-03-09", checkInTime: "09:00", checkOutTime: null, reason: "مجهول" }, boss.id)).toMatchObject({ ok: false });

    expect(await m.attendance.deleteRecord(user.id, "2026-03-09", "اتسجّل بالغلط", boss.id)).toEqual({ ok: true });
    expect(await m.attendance.deleteRecord(user.id, "2026-03-09", "تاني", boss.id)).toMatchObject({ ok: false });

    const trail = await m.attendance.editsBetween(user.id, "2026-03-01", "2026-03-31");
    expect(trail.map((e) => e.action).sort()).toEqual(["create", "delete", "update"]);
    expect(trail.every((e) => e.editorName === "boss user")).toBe(true);
    const update = trail.find((e) => e.action === "update");
    expect(update).toMatchObject({ reason: "تصحيح", oldCheckIn: at("2026-03-09", 7, 30), oldCheckOut: at("2026-03-09", 15), newCheckIn: at("2026-03-09", 7) });
    await expect(raw`insert into attendance_edits (user_id, work_date, action, reason) values (${user.id}, '2026-03-09', 'update', 'x')`).rejects.toThrow();
  });

  it("leaves: one per person, no overlap, bulk for everyone tracked, and dates expand per day", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const a = await tracked("a@x.com");
    const b = await tracked("b@x.com");
    const base = { kind: "annual" as const, startDate: "2026-03-10", endDate: "2026-03-12", note: "" };
    expect(await m.attendance.addLeave({ ...base, userIds: [a.id] }, boss.id)).toEqual({ ok: true, created: 1, skipped: 0 });
    expect(await m.attendance.addLeave({ ...base, startDate: "2026-03-12", endDate: "2026-03-14", userIds: [a.id] }, boss.id)).toMatchObject({ ok: false });
    // a holiday for everyone: a is already on leave those days, so only b gets it
    expect(await m.attendance.addLeave({ ...base, kind: "official", userIds: [a.id, b.id] }, boss.id)).toEqual({ ok: true, created: 1, skipped: 1 });
    expect(await m.attendance.addLeave({ ...base, startDate: "2026-03-20", endDate: "2026-03-19", userIds: [a.id] }, boss.id)).toMatchObject({ ok: false });
    expect(await m.attendance.addLeave({ ...base, startDate: "2026-03-01", endDate: "2027-12-31", userIds: [a.id] }, boss.id)).toMatchObject({ ok: false });
    const leaves = await m.attendance.leavesOverlapping("2026-03-01", "2026-03-31");
    expect(leaves).toHaveLength(2);
    expect([...m.attendance.leaveDateSet(leaves.filter((l) => l.userId === a.id), "2026-03-11", "2026-03-31")].sort()).toEqual(["2026-03-11", "2026-03-12"]);
    expect(await m.attendance.leavesOverlapping("2026-04-01", "2026-04-30")).toEqual([]);
    expect(await m.attendance.deleteLeave(leaves[0].id)).toBe(true);
    expect(await m.attendance.deleteLeave(leaves[0].id)).toBe(false);
  });

  it("two simultaneous leave requests for the same person make one leave", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const a = await tracked("a@x.com");
    const input = { kind: "sick" as const, startDate: "2026-03-10", endDate: "2026-03-11", note: "", userIds: [a.id] };
    const results = await Promise.all([m.attendance.addLeave(input, boss.id), m.attendance.addLeave(input, boss.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await raw`select 1 from leaves`).toHaveLength(1);
  });

  it("the board shows today for everyone: present, late, on leave, absent-so-far, and untracked", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const early = await tracked("early@x.com");
    const late = await tracked("late@x.com");
    const away = await tracked("away@x.com");
    const missing = await tracked("missing@x.com");
    await seedUser("free@x.com", "employee");
    await raw`update work_schedules set tracked_since = '2026-03-01'`;
    const now = at("2026-03-10", 8, 30); // 10:30 in Cairo, a Tuesday
    await m.attendance.checkIn(early.id, at("2026-03-10", 6, 55));
    await m.attendance.checkIn(late.id, at("2026-03-10", 7, 45));
    await m.attendance.addLeave({ kind: "sick", startDate: "2026-03-10", endDate: "2026-03-10", note: "", userIds: [away.id] }, boss.id);
    const board = await m.attendance.todayBoard(now);
    const status = (id: string) => board.find((r) => r.userId === id)?.status;
    expect(status(early.id)).toBe("present");
    expect(status(late.id)).toBe("late");
    expect(status(away.id)).toBe("leave");
    expect(status(missing.id)).toBe("missing");
    expect(board.find((r) => r.name === "free user")).toMatchObject({ schedule: null, status: null });
    expect(await m.attendance.todayBoard(at("2026-03-10", 6, 30))).toBeTruthy();
    expect((await m.attendance.todayBoard(at("2026-03-10", 6, 30))).find((r) => r.userId === missing.id)?.status).toBe("pending");
  });

  it("the monthly report adds days, lateness, leave, absence and hours per tracked person", async () => {
    const boss = await seedUser("boss@x.com", "manager");
    const user = await tracked();
    await raw`update work_schedules set tracked_since = '2026-03-01' where user_id = ${user.id}`;
    await m.attendance.saveRecord({ userId: user.id, date: "2026-03-02", checkInTime: "09:00", checkOutTime: "17:00", reason: "اختبار" }, boss.id);
    await m.attendance.saveRecord({ userId: user.id, date: "2026-03-03", checkInTime: "09:45", checkOutTime: "17:15", reason: "اختبار" }, boss.id);
    await m.attendance.saveRecord({ userId: user.id, date: "2026-03-04", checkInTime: "09:00", checkOutTime: null, reason: "اختبار" }, boss.id);
    await m.attendance.addLeave({ kind: "annual", startDate: "2026-03-05", endDate: "2026-03-05", note: "", userIds: [user.id] }, boss.id);
    const [row] = await m.attendance.monthReport("2026-03", at("2026-03-10", 12));
    expect(row).toMatchObject({ userId: user.id, name: "dev user" });
    expect(row.summary).toMatchObject({ presentDays: 3, lateDays: 1, lateMinutes: 45, leaveDays: 1, workedMinutes: 480 + 450, noCheckoutDays: 1, absentDays: 3 }); // absent: Sun 1st, Sun 8th, Mon 9th
    const person = await m.attendance.personMonth(user.id, "2026-03", at("2026-03-10", 12));
    expect(person?.summary.presentDays).toBe(3);
    expect(await m.attendance.personMonth((await seedUser("free@x.com", "employee")).id, "2026-03")).toBeNull();
  });
});
