import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { migrate } from "../db/migrate.mjs";

// Server actions and route handlers with Next's request APIs faked. The point: every entry point checks the session
// AND the role by itself, and a stranger can't get past the intake signature.

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";
const DB_NAME = `cn_ops_test_${Math.random().toString(36).slice(2, 10)}`;
const SECRET = "i".repeat(48);

const requestHeaders = new Headers();
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) as string } : undefined),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
  }),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, updateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { redirectTo: to });
  },
}));
vi.mock("@/server/pdf", () => ({
  PdfError: class PdfError extends Error {},
  renderProposalPdf: async () => Buffer.from("%PDF-1.7 fake"),
}));

type Mods = {
  db: typeof import("@/server/db");
  auth: typeof import("@/server/auth-core");
  crm: typeof import("@/server/crm");
  proposals: typeof import("@/server/proposals");
  password: typeof import("@/server/password");
  intake: typeof import("@/server/intake");
  actions: {
    auth: typeof import("@/app/actions/auth");
    crm: typeof import("@/app/actions/crm");
    proposals: typeof import("@/app/actions/proposals");
    admin: typeof import("@/app/actions/admin");
    tasks: typeof import("@/app/actions/tasks");
    projects: typeof import("@/app/actions/projects");
    attendance: typeof import("@/app/actions/attendance");
  };
  exportRoute: typeof import("@/app/api/attendance/export/route");
};
const m = { actions: {} } as unknown as Mods;
let raw: ReturnType<typeof postgres>;

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
/** Runs an action and reports where it redirected to (null = it returned normally). */
const redirected = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    const to = (error as { redirectTo?: string }).redirectTo;
    if (!to) throw error;
    return to;
  }
  return null;
};

async function login(role: "owner" | "manager" | "employee", opts: { must?: boolean } = {}) {
  const email = `${role}-${Math.random().toString(36).slice(2, 7)}@x.com`;
  const [user] = await raw<{ id: string }[]>`
    insert into users (email, name, role, password_hash, must_change_password)
    values (${email}, ${role + " user"}, ${role}, ${await m.password.hashPassword("a long enough password")}, ${opts.must ?? false}) returning id`;
  const result = await m.auth.signIn(email, "a long enough password", { ipHash: `ip-${email}`, userAgent: null });
  if (!result.ok) throw new Error("sign-in failed");
  cookieJar.set("cn_ops", result.token);
  return { id: user.id, email };
}
const logout = () => cookieJar.clear();

const dealInput = { title: "موقع شركة", service: "موقع إلكتروني", message: "", ownerId: "", value: "", currency: "EGP", clientName: "شركة النور", clientPhone: "+201000000001", clientEmail: "" };

beforeAll(async () => {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();
  process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  process.env.INTAKE_SECRET = SECRET;
  raw = postgres(process.env.DATABASE_URL, { max: 3, onnotice: () => {} });
  await migrate(raw);
  vi.resetModules();
  m.db = await import("@/server/db");
  m.auth = await import("@/server/auth-core");
  m.crm = await import("@/server/crm");
  m.proposals = await import("@/server/proposals");
  m.password = await import("@/server/password");
  m.intake = await import("@/server/intake");
  m.actions.auth = await import("@/app/actions/auth");
  m.actions.crm = await import("@/app/actions/crm");
  m.actions.proposals = await import("@/app/actions/proposals");
  m.actions.admin = await import("@/app/actions/admin");
  m.actions.tasks = await import("@/app/actions/tasks");
  m.actions.projects = await import("@/app/actions/projects");
  m.actions.attendance = await import("@/app/actions/attendance");
  m.exportRoute = await import("@/app/api/attendance/export/route");
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
  cookieJar.clear();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  requestHeaders.set("x-forwarded-for", "203.0.113.7");
});

describe("who can reach what", () => {
  it("with no session every action sends you to the login page and changes nothing", async () => {
    expect(await redirected(() => m.actions.crm.createDealAction(null, form(dealInput)))).toBe("/login");
    expect(await redirected(() => m.actions.crm.moveDealAction(null, form({ id: "00000000-0000-0000-0000-000000000000", stage: "won" })))).toBe("/login");
    expect(await redirected(() => m.actions.proposals.createProposalAction(form({ dealId: "00000000-0000-0000-0000-000000000000" })))).toBe("/login");
    expect(await redirected(() => m.actions.admin.createUserAction(null, form({ email: "a@b.co", name: "x y", role: "owner" })))).toBe("/login");
    expect(await redirected(() => m.actions.admin.saveCompanyAction(null, form({ name: "هاك" })))).toBe("/login");
    expect(await raw`select 1 from deals`).toHaveLength(0);
    expect(await raw`select 1 from users`).toHaveLength(0);
  });

  it("a user who must change the temporary password can do nothing else until they do", async () => {
    await login("manager", { must: true });
    expect(await redirected(() => m.actions.crm.createDealAction(null, form(dealInput)))).toBe("/account/password");
    expect(await raw`select 1 from deals`).toHaveLength(0);
    expect(await m.actions.auth.changePasswordAction(null, form({ current: "a long enough password", next: "x", repeat: "y" }))).toMatchObject({ fieldErrors: { repeat: expect.any(String) } });
    expect(await m.actions.auth.changePasswordAction(null, form({ current: "wrong wrong wrong", next: "a brand new passphrase", repeat: "a brand new passphrase" }))).toMatchObject({ error: "الباسورد الحالي غلط" });
    expect(await redirected(() => m.actions.auth.changePasswordAction(null, form({ current: "a long enough password", next: "a brand new passphrase", repeat: "a brand new passphrase" })))).toBe("/");
    expect(await redirected(() => m.actions.crm.createDealAction(null, form(dealInput)))).toMatch(/^\/crm\/deals\//);
  });

  it("an employee is turned away from everything that isn't their own work: no deals, clients, proposals, company or team", async () => {
    const owner = await login("owner");
    const { id: dealId } = await m.crm.createDeal({ title: "صفقة", service: null, source: "manual", valueMinor: null, currency: null, ownerId: null, message: null, client: { name: "عميل", phone: null, email: null } }, null);
    const proposalId = (await m.proposals.createProposalForDeal(dealId, owner.id)) as string;
    logout();
    await login("employee");
    const to = async (run: () => Promise<unknown>) => redirected(run);
    expect(await to(() => m.actions.crm.createDealAction(null, form(dealInput)))).toBe("/");
    expect(await to(() => m.actions.crm.moveDealAction(null, form({ id: dealId, stage: "won" })))).toBe("/");
    expect(await to(() => m.actions.crm.assignDealAction(null, form({ id: dealId, ownerId: "" })))).toBe("/");
    expect(await to(() => m.actions.crm.updateDealAction(null, form({ id: dealId, title: "هاك", service: "", value: "", currency: "EGP" })))).toBe("/");
    expect(await to(() => m.actions.crm.saveClientAction(null, form({ name: "هاك" })))).toBe("/");
    expect(await to(() => m.actions.proposals.createProposalAction(form({ dealId })))).toBe("/");
    expect(await to(() => m.actions.proposals.saveProposalAction(null, form({ id: proposalId, payload: "{}" })))).toBe("/");
    expect(await to(() => m.actions.proposals.markSentAction(null, form({ id: proposalId })))).toBe("/");
    expect(await to(() => m.actions.proposals.duplicateProposalAction(form({ id: proposalId })))).toBe("/");
    expect(await to(() => m.actions.admin.saveCompanyAction(null, form({ name: "هاك" })))).toBe("/");
    expect(await to(() => m.actions.admin.createUserAction(null, form({ email: "a@b.co", name: "x y", role: "owner" })))).toBe("/");
    expect(await to(() => m.actions.admin.resetPasswordAction(null, form({ id: dealId })))).toBe("/");
    expect(await raw`select count(*)::int as n from users`).toEqual([{ n: 2 }]);
    expect((await m.crm.getDeal(dealId))?.stage).toBe("new");
  });

  it("a manager can't touch the team; the owner can, and sees the one-time password", async () => {
    await login("manager");
    expect(await redirected(() => m.actions.admin.createUserAction(null, form({ email: "n@x.com", name: "جديد جدًا", role: "employee" })))).toBe("/");
    expect(await redirected(() => m.actions.admin.setRoleAction(form({ id: "00000000-0000-0000-0000-000000000000", role: "owner" })))).toBe("/");
    logout();
    await login("owner");
    const made = await m.actions.admin.createUserAction(null, form({ email: "n@x.com", name: "جديد جدًا", role: "employee" }));
    expect(made).toMatchObject({ ok: true, message: expect.stringContaining("الباسورد المؤقت") });
    expect((await raw`select must_change_password from users where email = 'n@x.com'`)[0]).toEqual({ must_change_password: true });
    expect(await m.actions.admin.createUserAction(null, form({ email: "n@x.com", name: "تاني جدًا", role: "employee" }))).toEqual({ error: "الإيميل ده مسجّل قبل كده" });
    expect(await m.actions.admin.createUserAction(null, form({ email: "m@x.com", name: "جديد جدًا", role: "god" }))).toEqual({ error: "دور غير صالح" });
  });
});

describe("deals through the actions", () => {
  it("a manager creates a deal, with validation errors per field, and an employee only touches their own", async () => {
    const manager = await login("manager");
    expect(await m.actions.crm.createDealAction(null, form({ ...dealInput, title: "x", clientName: "" }))).toMatchObject({ fieldErrors: { title: expect.any(String) } });
    expect(await m.actions.crm.createDealAction(null, form({ ...dealInput, value: "abc" }))).toMatchObject({ fieldErrors: { value: expect.any(String) } });
    const to = await redirected(() => m.actions.crm.createDealAction(null, form({ ...dealInput, value: "25,000", ownerId: manager.id })));
    const dealId = to!.split("/").pop() as string;
    expect(await m.crm.getDeal(dealId)).toMatchObject({ valueMinor: 2_500_000, currency: "EGP", ownerId: manager.id, source: "manual" });

    const other = await m.crm.createDeal({ title: "لحد تاني", service: null, source: "manual", valueMinor: null, currency: null, ownerId: manager.id, message: null, client: { name: "عميل", phone: null, email: null } }, null);
    logout();
    const employee = await login("employee");
    await m.crm.assignDeal(dealId, employee.id, manager.id);
    expect(await m.actions.crm.addActivityAction(null, form({ id: dealId, kind: "call", body: "كلمته" }))).toEqual({ ok: true });
    expect(await redirected(() => m.actions.crm.addActivityAction(null, form({ id: other.id, kind: "note", body: "تطفّل" })))).toBe("/crm");
    expect(await redirected(() => m.actions.crm.addFollowUpAction(null, form({ id: other.id, dueAt: "2026-12-01T10:00" })))).toBe("/crm");
    expect((await m.crm.listActivities(other.id)).map((a) => a.body)).not.toContain("تطفّل");
    expect(await m.actions.crm.addActivityAction(null, form({ id: dealId, kind: "bogus", body: "x" }))).toEqual({ error: "نوع نشاط غير صالح" });
    expect(await m.actions.crm.addActivityAction(null, form({ id: dealId, kind: "note", body: "" }))).toMatchObject({ fieldErrors: { body: expect.any(String) } });

    const followUp = await m.actions.crm.addFollowUpAction(null, form({ id: dealId, dueAt: "2026-12-01T10:00", note: "اتصل" }));
    expect(followUp).toEqual({ ok: true });
    const [mine] = await m.crm.listFollowUps({ dealId });
    // completing a follow-up on someone else's deal is refused too
    const foreign = await raw<{ id: string }[]>`insert into follow_ups (deal_id, due_at) values (${other.id}, now()) returning id`;
    await redirected(() => m.actions.crm.completeFollowUpAction(form({ id: foreign[0].id })));
    expect((await raw`select done_at from follow_ups where id = ${foreign[0].id}`)[0].done_at).toBeNull();
    await m.actions.crm.completeFollowUpAction(form({ id: mine.id }));
    expect((await raw`select done_at from follow_ups where id = ${mine.id}`)[0].done_at).not.toBeNull();
  });

  it("moving, losing and assigning go through the rules; assigning to a suspended user is refused", async () => {
    const manager = await login("manager");
    const suspended = await raw<{ id: string }[]>`insert into users (email, name, role, password_hash, active) values ('s@x.com', 'موقوف', 'employee', 'x', false) returning id`;
    const { id } = await m.crm.createDeal({ title: "صفقة", service: null, source: "manual", valueMinor: null, currency: null, ownerId: null, message: null, client: { name: "عميل", phone: null, email: null } }, manager.id);
    expect(await m.actions.crm.moveDealAction(null, form({ id, stage: "lost" }))).toEqual({ error: "اكتب سبب الخسارة" });
    expect(await m.actions.crm.moveDealAction(null, form({ id, stage: "banana" }))).toEqual({ error: "طلب غير صالح" });
    expect(await m.actions.crm.moveDealAction(null, form({ id, stage: "lost", lostReason: "السعر" }))).toEqual({ ok: true });
    expect(await m.actions.crm.assignDealAction(null, form({ id, ownerId: suspended[0].id }))).toEqual({ error: "المستخدم ده مش موجود أو موقوف" });
    expect(await m.actions.crm.assignDealAction(null, form({ id, ownerId: manager.id }))).toEqual({ ok: true });
  });
});

describe("proposal actions", () => {
  it("a manager builds, saves, exports-ready and sends a proposal; the deal moves; a sent one can't be saved again", async () => {
    const manager = await login("manager");
    const { id: dealId } = await m.crm.createDeal({ title: "صفقة", service: "موقع إلكتروني", source: "manual", valueMinor: null, currency: null, ownerId: null, message: null, client: { name: "عميل", phone: null, email: null } }, manager.id);
    const to = await redirected(() => m.actions.proposals.createProposalAction(form({ dealId })));
    const id = to!.split("/").pop() as string;
    const payload = (over: object = {}) =>
      JSON.stringify({
        title: "عرض",
        currency: "SAR",
        taxPercent: "15",
        discount: "",
        validUntil: "",
        intro: "",
        items: [{ title: "بند", description: "", quantity: 1, price: "1000" }],
        milestones: [{ title: "الكل", percent: "100" }],
        sections: [],
        timeline: [],
        ...over,
      });
    expect(await m.actions.proposals.saveProposalAction(null, form({ id, payload: "not json" }))).toEqual({ error: "بيانات العرض غير صالحة" });
    expect(await m.actions.proposals.saveProposalAction(null, form({ id, payload: payload({ currency: "XXX" }) }))).toMatchObject({ error: expect.any(String) });
    expect(await m.actions.proposals.saveProposalAction(null, form({ id, payload: payload() }))).toMatchObject({ ok: true });
    expect(await m.actions.proposals.markSentAction(null, form({ id }))).toMatchObject({ ok: true });
    expect((await m.crm.getDeal(dealId))?.stage).toBe("proposal_sent");
    expect(await m.actions.proposals.saveProposalAction(null, form({ id, payload: payload({ title: "بعد الإرسال" }) }))).toEqual({ error: "العرض اتبعت، اعمل نسخة جديدة منه عشان تعدّل" });
    expect(await m.actions.proposals.outcomeAction(null, form({ id, outcome: "accepted" }))).toEqual({ ok: true });
    expect(await m.actions.proposals.outcomeAction(null, form({ id, outcome: "maybe" }))).toEqual({ error: "طلب غير صالح" });
    const copy = await redirected(() => m.actions.proposals.duplicateProposalAction(form({ id })));
    expect(copy).toMatch(/^\/proposals\//);
  });
});

describe("website intake endpoint", () => {
  const lead = { externalId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "منى حسن", phone: "+201000000002", email: "mona@example.com", service: "موقع إلكتروني", message: "أريد موقعًا" };
  const request = (body: string, headers: Record<string, string> = {}, sign = true) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Request("http://localhost/api/intake/website", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(sign ? { "X-Timestamp": timestamp, "X-Signature": m.intake.signIntake(SECRET, timestamp, body) } : {}), ...headers },
      body,
    });
  };
  const post = async (req: Request) => (await import("@/app/api/intake/website/route")).POST(req);

  it("turns a correctly signed lead into a deal (once, even if it is delivered twice)", async () => {
    const body = JSON.stringify(lead);
    const first = await post(request(body));
    expect(first.status).toBe(200);
    const created = (await first.json()) as { ok: boolean; id: string; created: boolean };
    expect(created).toMatchObject({ ok: true, created: true });
    const second = await post(request(body));
    expect(await second.json()).toEqual({ ok: true, id: created.id, created: false });
    expect(await raw`select count(*)::int as n from deals`).toEqual([{ n: 1 }]);
    expect(await m.crm.getDeal(created.id)).toMatchObject({ source: "website", stage: "new", ownerId: null, clientName: "منى حسن", service: "موقع إلكتروني" });
  });

  it("refuses everything that isn't a fresh, correctly signed request, all with the same bland 401", async () => {
    const body = JSON.stringify(lead);
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    const cases = [
      request(body, {}, false),
      request(body, { "X-Signature": "sha256=" + "0".repeat(64) }),
      request(body.replace("منى", "هاك")),
      new Request("http://localhost/api/intake/website", { method: "POST", headers: { "X-Timestamp": stale, "X-Signature": m.intake.signIntake(SECRET, stale, body) }, body }),
    ];
    // the 3rd case: body changed after signing -> rebuild with the OLD signature
    const timestamp = String(Math.floor(Date.now() / 1000));
    cases[2] = new Request("http://localhost/api/intake/website", { method: "POST", headers: { "X-Timestamp": timestamp, "X-Signature": m.intake.signIntake(SECRET, timestamp, body) }, body: body.replace("منى", "هاك") });
    for (const req of cases) {
      const response = await post(req);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
    expect(await raw`select 1 from deals`).toHaveLength(0);
  });

  it("validates a signed body (400), caps its size (413) and is switched off without a secret (503)", async () => {
    expect((await post(request("not json"))).status).toBe(400);
    expect((await post(request(JSON.stringify({ ...lead, phone: "12" })))).status).toBe(400);
    expect((await post(request(JSON.stringify({ ...lead, message: "x".repeat(11_000) })))).status).toBe(413);
    const saved = process.env.INTAKE_SECRET;
    delete process.env.INTAKE_SECRET;
    expect((await post(request(JSON.stringify(lead)))).status).toBe(503);
    process.env.INTAKE_SECRET = saved;
    expect(await raw`select 1 from deals`).toHaveLength(0);
  });
});

describe("PDF route", () => {
  const call = async (id: string) => (await import("@/app/api/proposals/[id]/pdf/route")).GET(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

  it("is closed to strangers and employees, refuses incomplete proposals, and serves a PDF to a manager", async () => {
    const manager = await login("manager");
    const { id: dealId } = await m.crm.createDeal({ title: "صفقة", service: null, source: "manual", valueMinor: null, currency: null, ownerId: null, message: null, client: { name: "عميل", phone: null, email: null } }, manager.id);
    const id = (await m.proposals.createProposalForDeal(dealId, manager.id)) as string;

    const incomplete = await call(id);
    expect(incomplete.status).toBe(409);
    expect(await incomplete.text()).toMatch(/بند/);
    expect((await call("00000000-0000-0000-0000-000000000000")).status).toBe(404);

    const parsed = m.proposals.parseProposalInput({ title: "عرض", currency: "EGP", taxPercent: "", discount: "", validUntil: "", intro: "", items: [{ title: "بند", description: "", quantity: 1, price: "100" }], milestones: [{ title: "الكل", percent: "100" }], sections: [], timeline: [] });
    if (!parsed.ok) throw new Error(parsed.error);
    await m.proposals.saveProposal(id, parsed.data);
    const ok = await call(id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition")).toBe(`attachment; filename="P-${new Date().getFullYear()}-0001.pdf"`);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await ok.arrayBuffer()).toString().startsWith("%PDF")).toBe(true);

    logout();
    expect(await redirected(() => call(id))).toBe("/login");
    await login("employee");
    expect(await redirected(() => call(id))).toBe("/");
  });
});

describe("tasks and projects: who can do what", () => {
  const ZERO = "00000000-0000-0000-0000-000000000000";
  const taskInput = { title: "مهمة جديدة", description: "", priority: "normal", dueDate: "", assigneeId: "", projectId: "", dealId: "", clientId: "" };
  const taskCount = async () => (await raw`select 1 from tasks`).length;

  async function seedTask(assigneeId: string | null, creatorId: string, title = "مهمة") {
    const [row] = await raw<{ id: string }[]>`insert into tasks (title, assignee_id, created_by) values (${title}, ${assigneeId}, ${creatorId}) returning id`;
    return row.id;
  }
  const statusOf = async (id: string) => (await raw<{ status: string }[]>`select status from tasks where id = ${id}`)[0].status;

  it("with no session every task and project action sends you to the login page and changes nothing", async () => {
    expect(await redirected(() => m.actions.tasks.createTaskAction(null, form(taskInput)))).toBe("/login");
    expect(await redirected(() => m.actions.tasks.updateTaskAction(null, form({ ...taskInput, id: ZERO })))).toBe("/login");
    expect(await redirected(() => m.actions.tasks.assignTaskAction(null, form({ id: ZERO, assigneeId: "" })))).toBe("/login");
    expect(await redirected(() => m.actions.tasks.changeTaskStatusAction(null, form({ id: ZERO, status: "doing" })))).toBe("/login");
    expect(await redirected(() => m.actions.tasks.addCommentAction(null, form({ id: ZERO, body: "x" })))).toBe("/login");
    expect(await redirected(() => m.actions.projects.createProjectAction(null, form({ name: "مشروع", startDate: "2026-01-01" })))).toBe("/login");
    expect(await redirected(() => m.actions.projects.startProjectAction(null, form({ dealId: ZERO })))).toBe("/login");
    expect(await taskCount()).toBe(0);
  });

  it("an employee can't create, edit, assign tasks or create/start projects", async () => {
    const dev = await login("employee");
    const id = await seedTask(dev.id, dev.id);
    for (const run of [
      () => m.actions.tasks.createTaskAction(null, form(taskInput)),
      () => m.actions.tasks.updateTaskAction(null, form({ ...taskInput, id })),
      () => m.actions.tasks.assignTaskAction(null, form({ id, assigneeId: "" })),
      () => m.actions.projects.createProjectAction(null, form({ name: "مشروع", startDate: "2026-01-01" })),
      () => m.actions.projects.updateProjectAction(null, form({ id: ZERO, status: "done", name: "مشروع", startDate: "2026-01-01" })),
      () => m.actions.projects.startProjectAction(null, form({ dealId: ZERO })),
    ]) {
      expect(await redirected(run)).toBe("/");
    }
    expect(await taskCount()).toBe(1);
    expect((await raw<{ assignee_id: string }[]>`select assignee_id from tasks`)[0].assignee_id).toBe(dev.id);
  });

  it("an employee moves their own task, comments on it, but can't close it or touch a colleague's", async () => {
    const boss = await login("owner");
    const bossTask = await seedTask(null, boss.id);
    logout();
    const dev = await login("employee");
    const mine = await seedTask(dev.id, boss.id);
    const theirs = await seedTask(boss.id, boss.id, "بتاعة المدير");

    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id: mine, status: "doing" }))).toEqual({ ok: true });
    expect(await statusOf(mine)).toBe("doing");
    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id: mine, status: "blocked" }))).toMatchObject({ error: expect.any(String) });
    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id: mine, status: "blocked", reason: "مستني بيانات" }))).toEqual({ ok: true });
    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id: mine, status: "done" }))).toMatchObject({ error: expect.stringContaining("المدير") });
    expect(await statusOf(mine)).toBe("blocked");
    expect(await m.actions.tasks.addCommentAction(null, form({ id: mine, body: "بدأت" }))).toEqual({ ok: true });
    expect(await m.actions.tasks.addCommentAction(null, form({ id: mine, body: "  " }))).toMatchObject({ fieldErrors: { body: expect.any(String) } });

    // Someone else's task, or one nobody owns, looks exactly like a task that doesn't exist.
    for (const other of [theirs, bossTask, ZERO]) {
      expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id: other, status: "doing" }))).toEqual({ error: "المهمة مش موجودة" });
      expect(await m.actions.tasks.addCommentAction(null, form({ id: other, body: "تطفل" }))).toEqual({ error: "المهمة مش موجودة" });
    }
    expect(await statusOf(theirs)).toBe("todo");
    expect(await raw`select 1 from task_events where body = 'تطفل'`).toHaveLength(0);
  });

  it("a manager creates, assigns, edits and closes; bad ids come back as friendly errors", async () => {
    await login("manager");
    const [dev] = await raw<{ id: string }[]>`insert into users (email, name, role, password_hash) values ('dev@x.com', 'مطور', 'employee', 'x') returning id`;
    const [off] = await raw<{ id: string }[]>`insert into users (email, name, role, password_hash, active) values ('off@x.com', 'موقوف', 'employee', 'x', false) returning id`;

    expect(await m.actions.tasks.createTaskAction(null, form({ ...taskInput, title: "x" }))).toMatchObject({ fieldErrors: { title: expect.any(String) } });
    expect(await m.actions.tasks.createTaskAction(null, form({ ...taskInput, dueDate: "2026-02-31" }))).toMatchObject({ fieldErrors: { dueDate: expect.any(String) } });
    expect(await m.actions.tasks.createTaskAction(null, form({ ...taskInput, assigneeId: off.id }))).toMatchObject({ error: expect.stringContaining("موقوف") });
    expect(await m.actions.tasks.createTaskAction(null, form({ ...taskInput, projectId: ZERO }))).toMatchObject({ error: "المشروع مش موجود" });
    expect(await taskCount()).toBe(0);

    const to = await redirected(() => m.actions.tasks.createTaskAction(null, form({ ...taskInput, assigneeId: dev.id, dueDate: "2026-06-01" })));
    expect(to).toMatch(/^\/tasks\//);
    const id = to!.split("/").pop()!;
    expect(await m.actions.tasks.assignTaskAction(null, form({ id, assigneeId: "" }))).toEqual({ ok: true });
    expect(await m.actions.tasks.assignTaskAction(null, form({ id, assigneeId: dev.id }))).toEqual({ ok: true });
    expect(await m.actions.tasks.updateTaskAction(null, form({ ...taskInput, id, title: "عنوان معدّل", priority: "urgent" }))).toEqual({ ok: true });
    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id, status: "done" }))).toEqual({ ok: true });
    expect(await raw`select 1 from tasks where id = ${id} and title = 'عنوان معدّل' and priority = 'urgent' and completed_at is not null and assignee_id = ${dev.id}`).toHaveLength(1);
    expect(await m.actions.tasks.changeTaskStatusAction(null, form({ id, status: "sleeping" }))).toEqual({ error: "طلب غير صالح" });
  });

  it("a manager starts a project from a won deal once; the result page is the project", async () => {
    const boss = await login("manager");
    const dealInputWon = await redirected(() => m.actions.crm.createDealAction(null, form(dealInput)));
    const dealId = dealInputWon!.split("/").pop()!;
    expect(await m.actions.projects.startProjectAction(null, form({ dealId, startDate: "2026-01-01" }))).toMatchObject({ error: expect.stringContaining("فاز") });
    expect(await m.actions.crm.moveDealAction(null, form({ id: dealId, stage: "won" }))).toEqual({ ok: true });
    expect(await m.actions.projects.startProjectAction(null, form({ dealId, startDate: "2026-13-01" }))).toMatchObject({ fieldErrors: { startDate: expect.any(String) } });
    const to = await redirected(() => m.actions.projects.startProjectAction(null, form({ dealId, startDate: "2026-01-01" })));
    expect(to).toMatch(/^\/projects\//);
    expect(await raw`select 1 from projects where deal_id = ${dealId} and manager_id = ${boss.id}`).toHaveLength(1);
  });

  it("project forms validate dates and references", async () => {
    await login("owner");
    const base = { name: "مشروع", clientId: "", managerId: "", startDate: "2026-01-10", dueDate: "", notes: "" };
    expect(await m.actions.projects.createProjectAction(null, form({ ...base, dueDate: "2026-01-01" }))).toMatchObject({ fieldErrors: { dueDate: expect.any(String) } });
    expect(await m.actions.projects.createProjectAction(null, form({ ...base, startDate: "" }))).toMatchObject({ fieldErrors: { startDate: expect.any(String) } });
    expect(await m.actions.projects.createProjectAction(null, form({ ...base, clientId: ZERO }))).toMatchObject({ error: "العميل مش موجود" });
    const to = await redirected(() => m.actions.projects.createProjectAction(null, form(base)));
    const id = to!.split("/").pop()!;
    expect(await m.actions.projects.updateProjectAction(null, form({ ...base, id, status: "done" }))).toEqual({ ok: true });
    expect(await m.actions.projects.updateProjectAction(null, form({ ...base, id, status: "bogus" }))).toEqual({ error: "طلب غير صالح" });
    expect(await raw`select 1 from projects where id = ${id} and status = 'done' and closed_at is not null`).toHaveLength(1);
  });
});

describe("attendance: who can do what", () => {
  const ZERO = "00000000-0000-0000-0000-000000000000";
  const shiftForm = (userId: string, over: Record<string, string> = {}) => {
    const data = form({ userId, startTime: "00:00", endTime: "23:59", graceMinutes: "15", ...over });
    data.append("workDays", "0");
    for (const d of [1, 2, 3, 4, 5, 6]) data.append("workDays", String(d));
    return data;
  };
  const count = async (table: "attendance" | "work_schedules" | "leaves" | "attendance_edits") => (await raw`select 1 from ${raw(table)}`).length;

  it("with no session every attendance action sends you to the login page and changes nothing", async () => {
    const a = m.actions.attendance;
    for (const run of [
      () => a.checkInAction(),
      () => a.checkOutAction(),
      () => a.saveShiftAction(null, shiftForm(ZERO)),
      () => a.removeShiftAction(null, form({ userId: ZERO })),
      () => a.saveRecordAction(null, form({ userId: ZERO, date: "2026-03-09", checkIn: "09:00", checkOut: "", reason: "سبب" })),
      () => a.deleteRecordAction(null, form({ userId: ZERO, date: "2026-03-09", reason: "سبب" })),
      () => a.addLeaveAction(null, form({ userId: ZERO, kind: "annual", startDate: "2026-03-09", endDate: "2026-03-09", note: "" })),
      () => a.deleteLeaveAction(form({ id: ZERO })),
      () => m.exportRoute.GET(new Request("http://x/api/attendance/export?month=2026-03")),
    ]) {
      expect(await redirected(run)).toBe("/login");
    }
    expect(await count("work_schedules")).toBe(0);
  });

  it("an employee can check in and out for themselves only, and can't manage shifts, records, leaves or the export", async () => {
    const dev = await login("employee");
    const other = (await raw<{ id: string }[]>`insert into users (email, name, role, password_hash) values ('other@x.com', 'زميل', 'employee', 'x') returning id`)[0];
    const a = m.actions.attendance;
    expect(await a.checkInAction()).toMatchObject({ error: expect.stringContaining("وردية") });

    // a manager gives this employee a shift (all week, all day: the test can't depend on the time of day)
    const manager = await raw<{ id: string }[]>`select id from users where id = ${dev.id}`;
    expect(manager).toHaveLength(1);
    await raw`insert into work_schedules (user_id, start_time, end_time, work_days, grace_minutes) values (${dev.id}, '00:00', '23:59', '{0,1,2,3,4,5,6}', 15)`;
    expect(await a.checkInAction()).toEqual({ ok: true, message: "اتسجّل حضورك" });
    expect(await a.checkInAction()).toMatchObject({ error: "سجّلت حضورك النهارده بالفعل" });
    expect((await raw<{ user_id: string }[]>`select user_id from attendance`).map((r) => r.user_id)).toEqual([dev.id]);
    await raw`update attendance set check_in = now() - interval '1 hour'`;
    expect(await a.checkOutAction()).toEqual({ ok: true, message: "اتسجّل انصرافك" });
    expect(await a.checkOutAction()).toMatchObject({ error: "سجّلت انصرافك بالفعل" });

    for (const run of [
      () => a.saveShiftAction(null, shiftForm(other.id)),
      () => a.removeShiftAction(null, form({ userId: dev.id })),
      () => a.saveRecordAction(null, form({ userId: dev.id, date: "2026-03-09", checkIn: "09:00", checkOut: "", reason: "أنا بعدّل" })),
      () => a.deleteRecordAction(null, form({ userId: dev.id, date: "2026-03-09", reason: "أنا بمسح" })),
      () => a.addLeaveAction(null, form({ userId: dev.id, kind: "annual", startDate: "2026-03-09", endDate: "2026-03-09", note: "" })),
      () => a.deleteLeaveAction(form({ id: ZERO })),
      () => m.exportRoute.GET(new Request("http://x/api/attendance/export")),
    ]) {
      expect(await redirected(run)).toBe("/");
    }
    expect(await count("work_schedules")).toBe(1);
    expect(await count("leaves")).toBe(0);
    expect(await count("attendance_edits")).toBe(0);
  });

  it("a manager sets shifts, fixes days with a reason, enters leaves, and validation says what is wrong", async () => {
    await login("manager");
    const a = m.actions.attendance;
    const [dev] = await raw<{ id: string }[]>`insert into users (email, name, role, password_hash) values ('dev@x.com', 'مطور', 'employee', 'x') returning id`;

    expect(await a.saveShiftAction(null, shiftForm(dev.id, { startTime: "9am" }))).toMatchObject({ fieldErrors: { startTime: expect.any(String) } });
    expect(await a.saveShiftAction(null, shiftForm(dev.id, { graceMinutes: "500" }))).toMatchObject({ fieldErrors: { graceMinutes: expect.any(String) } });
    expect(await a.saveShiftAction(null, form({ userId: dev.id, startTime: "09:00", endTime: "17:00", graceMinutes: "15" }))).toMatchObject({ fieldErrors: { workDays: expect.any(String) } });
    expect(await a.saveShiftAction(null, shiftForm(dev.id, { startTime: "18:00", endTime: "09:00" }))).toMatchObject({ error: expect.any(String) });
    expect(await count("work_schedules")).toBe(0);
    expect(await a.saveShiftAction(null, shiftForm(dev.id, { startTime: "09:00", endTime: "17:00" }))).toEqual({ ok: true });

    const record = { userId: dev.id, date: "2026-03-09", checkIn: "09:30", checkOut: "17:00" };
    expect(await a.saveRecordAction(null, form({ ...record, reason: "" }))).toMatchObject({ fieldErrors: { reason: expect.any(String) } });
    expect(await a.saveRecordAction(null, form({ ...record, date: "2026-02-31", reason: "سبب" }))).toMatchObject({ fieldErrors: { date: expect.any(String) } });
    expect(await a.saveRecordAction(null, form({ ...record, checkIn: "25:00", reason: "سبب" }))).toMatchObject({ fieldErrors: { checkIn: expect.any(String) } });
    expect(await a.saveRecordAction(null, form({ ...record, checkOut: "08:00", reason: "سبب" }))).toMatchObject({ error: expect.any(String) });
    expect(await count("attendance")).toBe(0);
    expect(await a.saveRecordAction(null, form({ ...record, reason: "نسي يسجّل" }))).toEqual({ ok: true });
    expect(await raw`select 1 from attendance_edits where reason = 'نسي يسجّل'`).toHaveLength(1);
    expect(await a.deleteRecordAction(null, form({ userId: dev.id, date: "2026-03-09", reason: "غلط" }))).toMatchObject({ ok: true });

    const leave = { kind: "annual", startDate: "2026-03-10", endDate: "2026-03-12", note: "" };
    expect(await a.addLeaveAction(null, form({ ...leave, userId: "" }))).toMatchObject({ fieldErrors: { userId: expect.any(String) } });
    expect(await a.addLeaveAction(null, form({ ...leave, userId: dev.id, kind: "party" }))).toMatchObject({ fieldErrors: { kind: expect.any(String) } });
    expect(await a.addLeaveAction(null, form({ ...leave, userId: dev.id, endDate: "2026-03-01" }))).toMatchObject({ error: expect.any(String) });
    expect(await a.addLeaveAction(null, form({ ...leave, userId: dev.id }))).toMatchObject({ ok: true });
    expect(await a.addLeaveAction(null, form({ ...leave, userId: dev.id }))).toMatchObject({ error: expect.stringContaining("بالفعل") });
    // a holiday for everyone tracked: the one person already on leave is skipped, so nobody gets a second one
    expect(await a.addLeaveAction(null, form({ ...leave, everyone: "1" }))).toMatchObject({ error: expect.any(String) });
    expect(await count("leaves")).toBe(1);
    const [row] = await raw<{ id: string }[]>`select id from leaves`;
    await a.deleteLeaveAction(form({ id: row.id }));
    expect(await count("leaves")).toBe(0);
    expect(await a.removeShiftAction(null, form({ userId: dev.id }))).toMatchObject({ ok: true });
    expect(await a.removeShiftAction(null, form({ userId: dev.id }))).toMatchObject({ error: expect.any(String) });
  });

  it("the CSV export is a spreadsheet-safe file for managers, and ignores a bad month", async () => {
    await login("owner");
    const [dev] = await raw<{ id: string }[]>`insert into users (email, name, role, password_hash) values ('dev@x.com', '=HYPERLINK("x")', 'employee', 'x') returning id`;
    await raw`insert into work_schedules (user_id, start_time, end_time, work_days, tracked_since) values (${dev.id}, '09:00', '17:00', '{0,1,2,3,4}', '2026-03-01')`;
    const response = await m.exportRoute.GET(new Request("http://x/api/attendance/export?month=2026-03"));
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("attendance-2026-03.csv");
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());
    expect(body.startsWith("\uFEFF")).toBe(true);
    const lines = body.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith("\"'=HYPERLINK")).toBe(true);
    const fallback = await m.exportRoute.GET(new Request("http://x/api/attendance/export?month=bogus"));
    expect(fallback.headers.get("Content-Disposition")).toMatch(/attendance-\d{4}-\d{2}\.csv/);
  });
});
