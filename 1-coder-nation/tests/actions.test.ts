import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { migrate } from "../db/migrate.mjs";

// The public form action and the admin actions, run against a throw-away database with Next's request APIs faked
// (headers, cookies, cache invalidation). What matters here: strangers can't write garbage, and nothing in the panel
// works without a valid session.

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgres://localhost:5432/postgres";
const DB_NAME = `cn_site_test_${Math.random().toString(36).slice(2, 10)}`;

const requestHeaders = new Headers();
const cookieJar = new Map<string, string>();
const updatedTags: string[] = [];

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
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updatedTags.push(tag),
  refresh: () => {},
  cacheTag: () => {},
  cacheLife: () => {},
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { redirectTo: to });
  },
}));

type Mods = {
  db: typeof import("@/server/db");
  site: typeof import("@/app/(site)/actions");
  admin: typeof import("@/app/(admin)/admin/actions");
  session: typeof import("@/server/session");
  password: typeof import("@/server/password");
};
const m = {} as Mods;
let raw: ReturnType<typeof postgres>;

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const goodLead = { name: "منى حسن", phone: "+٢٠١٠٠٠٠٠٠٠٠٢", email: "mona@example.com", service: "تطبيق موبايل", message: "عايزة تطبيق" };
const redirectTarget = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return (error as { redirectTo?: string }).redirectTo ?? `unexpected: ${String(error)}`;
  }
  return null;
};

beforeAll(async () => {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();
  process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  raw = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });
  await migrate(raw);
  vi.resetModules();
  m.db = await import("@/server/db");
  m.site = await import("@/app/(site)/actions");
  m.admin = await import("@/app/(admin)/admin/actions");
  m.session = await import("@/server/session");
  m.password = await import("@/server/password");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await raw?.end({ timeout: 5 });
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${DB_NAME} with (force)`);
  await admin.end();
});

beforeEach(async () => {
  await raw`truncate leads, sessions, admins, rate_limits, settings restart identity cascade`;
  cookieJar.clear();
  updatedTags.length = 0;
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  requestHeaders.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
  requestHeaders.set("user-agent", "vitest-agent");
});

describe("submitLead (public form)", () => {
  it("stores a valid request with a normalized phone and a hashed IP, and tells the visitor it worked", async () => {
    expect(await m.site.submitLead(form(goodLead))).toEqual({ ok: true });
    const rows = await raw`select name, phone, email, service, status, ip_hash, user_agent from leads`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "منى حسن", phone: "+2010000000" + "02", email: "mona@example.com", service: "تطبيق موبايل", status: "new", user_agent: "vitest-agent" });
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(rows)).not.toContain("203.0.113.7");
  });

  it("returns field errors for bad input and stores nothing", async () => {
    const result = await m.site.submitLead(form({ ...goodLead, name: "x", phone: "abc" }));
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect((result as { fieldErrors: object }).fieldErrors).toHaveProperty("name");
    expect((result as { fieldErrors: object }).fieldErrors).toHaveProperty("phone");
    expect(await raw`select 1 from leads`).toHaveLength(0);
  });

  it("silently drops honeypot submissions (reports success, stores nothing)", async () => {
    expect(await m.site.submitLead(form({ ...goodLead, website: "http://spam.example" }))).toEqual({ ok: true });
    expect(await raw`select 1 from leads`).toHaveLength(0);
  });

  it("allows 5 requests per hour per visitor, then refuses; another visitor is unaffected", async () => {
    for (let i = 0; i < 5; i++) expect((await m.site.submitLead(form(goodLead))).ok, `request ${i + 1}`).toBe(true);
    expect(await m.site.submitLead(form(goodLead))).toMatchObject({ ok: false, reason: "limited" });
    expect(await raw`select 1 from leads`).toHaveLength(5);
    requestHeaders.set("x-forwarded-for", "198.51.100.9");
    expect((await m.site.submitLead(form(goodLead))).ok).toBe(true);
  });

  it("when the database is down it fails politely, without leaking anything about it", async () => {
    const saved = process.env.DATABASE_URL;
    await m.db.closeDatabase();
    process.env.DATABASE_URL = "postgres://localhost:1/nope";
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await m.site.submitLead(form(goodLead));
    quiet.mockRestore();
    process.env.DATABASE_URL = saved;
    await m.db.closeDatabase();
    expect(result).toMatchObject({ ok: false, reason: "server" });
    expect(JSON.stringify(result)).not.toMatch(/postgres|ECONNREFUSED|localhost|nope/i);
  });
});

describe("admin actions", () => {
  async function signInAsAdmin() {
    await raw`insert into admins (email, password_hash) values ('boss@codernation.com', ${await m.password.hashPassword("a long enough password")}) on conflict do nothing`;
    const target = await redirectTarget(() => m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "a long enough password" })));
    expect(target).toBe("/admin");
    expect(cookieJar.get("cn_admin")).toBeTruthy();
  }

  it("login: wrong credentials say so generically; right ones set the session cookie and go to /admin", async () => {
    await raw`insert into admins (email, password_hash) values ('boss@codernation.com', ${await m.password.hashPassword("a long enough password")})`;
    expect(await m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "wrong wrong wrong" }))).toEqual({ error: "الإيميل أو الباسورد غلط" });
    expect(await m.admin.loginAction(null, form({ email: "ghost@codernation.com", password: "wrong wrong wrong" }))).toEqual({ error: "الإيميل أو الباسورد غلط" });
    expect(await m.admin.loginAction(null, form({ email: "", password: "" }))).toMatchObject({ error: expect.any(String) });
    expect(cookieJar.has("cn_admin")).toBe(false);
    await signInAsAdmin();
  });

  it("EVERY admin action refuses without a session, and changes nothing", async () => {
    const [{ id }] = await raw`insert into leads (name, phone) values ('أحمد', '+201000000001') returning id`;
    expect(await redirectTarget(() => m.admin.updateLeadAction(null, form({ id, status: "closed", note: "hacked" })))).toBe("/admin/login");
    expect(await redirectTarget(() => m.admin.deleteLeadAction(form({ id })))).toBe("/admin/login");
    expect(await redirectTarget(() => m.admin.saveSettingsAction(null, form({ whatsappNumber: "201111111111" })))).toBe("/admin/login");
    expect(await raw`select status, note from leads where id = ${id}`).toEqual([{ status: "new", note: "" }]);
    expect(await raw`select 1 from settings`).toHaveLength(0);
    expect(updatedTags).toEqual([]);
  });

  it("an expired or forged cookie is no session either", async () => {
    cookieJar.set("cn_admin", "f".repeat(43));
    const [{ id }] = await raw`insert into leads (name, phone) values ('أحمد', '+201000000001') returning id`;
    expect(await redirectTarget(() => m.admin.deleteLeadAction(form({ id })))).toBe("/admin/login");
    expect(await raw`select 1 from leads`).toHaveLength(1);
  });

  it("with a session: updates a lead, rejects a bad status, deletes", async () => {
    await signInAsAdmin();
    const [{ id }] = await raw`insert into leads (name, phone) values ('أحمد', '+201000000001') returning id`;
    expect(await m.admin.updateLeadAction(null, form({ id, status: "contacted", note: "  كلمته  " }))).toEqual({ ok: true });
    expect(await raw`select status, note from leads where id = ${id}`).toEqual([{ status: "contacted", note: "كلمته" }]);
    expect(await m.admin.updateLeadAction(null, form({ id, status: "weird", note: "" }))).toEqual({ error: "حالة غير صالحة" });
    expect(await m.admin.updateLeadAction(null, form({ id: "00000000-0000-0000-0000-000000000000", status: "closed", note: "" }))).toMatchObject({ error: expect.any(String) });
    expect(await redirectTarget(() => m.admin.deleteLeadAction(form({ id })))).toBe("/admin/leads");
    expect(await raw`select 1 from leads`).toHaveLength(0);
  });

  it("with a session: saves settings, invalidates the site cache, and reports field errors without saving", async () => {
    await signInAsAdmin();
    const valid = {
      whatsappNumber: "+20 101 234 5678",
      email: "hi@codernation.com",
      workingHours: "كل يوم",
      seoTitle: "Coder Nation | مواقع وتطبيقات",
      seoDescription: "نصمّم ونبرمج مواقع وتطبيقات موبايل بجودة عالية وأداء ممتاز.",
      social_linkedin: "https://linkedin.com/company/x",
      eco_crm: "on",
    };
    expect(await m.admin.saveSettingsAction(null, form(valid))).toEqual({ ok: true });
    expect(updatedTags).toEqual(["settings"]);
    const [stored] = await raw`select value from settings`;
    expect(stored.value).toMatchObject({ whatsappNumber: "201012345678", socials: { linkedin: "https://linkedin.com/company/x", x: "" }, ecosystem: { crm: true, marketing: false } });

    updatedTags.length = 0;
    const bad = await m.admin.saveSettingsAction(null, form({ ...valid, whatsappNumber: "12", social_x: "javascript:alert(1)", seoTitle: "x" }));
    expect(bad).toMatchObject({ error: expect.any(String) });
    expect(Object.keys((bad as { fieldErrors: object }).fieldErrors).sort()).toEqual(["seoTitle", "social_x", "whatsappNumber"]);
    expect(updatedTags).toEqual([]);
    expect((await raw`select value from settings`)[0].value).toMatchObject({ whatsappNumber: "201012345678" });
  });

  it("logout deletes the session and clears the cookie", async () => {
    await signInAsAdmin();
    const token = cookieJar.get("cn_admin") as string;
    expect(await redirectTarget(() => m.admin.logoutAction())).toBe("/admin/login");
    expect(cookieJar.has("cn_admin")).toBe(false);
    expect(await raw`select 1 from sessions`).toHaveLength(0);
    cookieJar.set("cn_admin", token);
    expect(await m.session.getAdmin()).toBeNull();
  });
});

describe("CSV export route", () => {
  const request = (query = "") => new Request(`http://localhost/admin/leads/export${query}`);

  it("without a session it redirects to login and returns no data", async () => {
    await raw`insert into leads (name, phone) values ('سري', '+201000000001')`;
    const { GET } = await import("@/app/(admin)/admin/(panel)/leads/export/route");
    expect(await redirectTarget(() => GET(request()))).toBe("/admin/login");
  });

  it("with a session it returns a BOM'd CSV of the leads, neutralizes formulas, and honours the filters", async () => {
    await raw`insert into admins (email, password_hash) values ('boss@codernation.com', ${await m.password.hashPassword("a long enough password")})`;
    await redirectTarget(() => m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "a long enough password" })));
    await raw`insert into leads (name, phone, message, status) values ('=HYPERLINK("http://evil")', '+201000000001', 'a,b "c"', 'new'), ('عميل مغلق', '+201000000002', null, 'closed')`;
    const { GET } = await import("@/app/(admin)/admin/(panel)/leads/export/route");

    const all = await GET(request());
    expect(all.status).toBe(200);
    expect(all.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(all.headers.get("content-disposition")).toMatch(/^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(all.headers.get("cache-control")).toBe("no-store");
    // Read the raw bytes: Response.text() silently drops a leading BOM, which would hide whether it was sent.
    const bytes = new Uint8Array(await all.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    const lines = text.replace(/\r\n$/, "").split("\r\n"); // not trim(): String.trim() also strips the BOM
    expect(lines[0]).toBe("\uFEFFالاسم,الهاتف,الإيميل,نوع المشروع,التفاصيل,الحالة,ملاحظة,التاريخ");
    expect(lines).toHaveLength(3);
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(text).toContain(`"a,b ""c"""`);

    const closed = await (await GET(request("?status=closed"))).text();
    expect(closed.trim().split("\r\n")).toHaveLength(2);
    expect(closed).toContain("عميل مغلق");
    expect(closed).not.toContain("HYPERLINK");
    const bogus = await (await GET(request("?status=weird&q=%25"))).text();
    expect(bogus.trim().split("\r\n")).toHaveLength(1); // unknown status is ignored, "%" matches nothing
  });
});
