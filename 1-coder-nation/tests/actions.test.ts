import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Db } from "../src/server/sql";
import { clearTables, createTestDb, dropTestDb, type TestDb } from "./helpers/db";

// The public form action and the admin actions, run against a throw-away database with Next's request APIs faked
// (headers, cookies, cache invalidation). What matters here: strangers can't write garbage, and nothing in the panel
// works without a valid session.


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
let raw: Db;
let testDb: TestDb;

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
  testDb = await createTestDb("cn_site_test");
  raw = testDb.raw;
  process.env.DATABASE_URL = testDb.url;
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  vi.resetModules();
  m.db = await import("@/server/db");
  m.site = await import("@/app/(site)/actions");
  m.admin = await import("@/app/(admin)/admin/actions");
  m.session = await import("@/server/session");
  m.password = await import("@/server/password");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await dropTestDb(testDb);
});

beforeEach(async () => {
  await clearTables(raw, ["leads", "sessions", "admins", "rate_limits", "settings", "media"]);
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
    process.env.DATABASE_URL = "mysql://127.0.0.1:1/nope";
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await m.site.submitLead(form(goodLead));
    quiet.mockRestore();
    process.env.DATABASE_URL = saved;
    await m.db.closeDatabase();
    expect(result).toMatchObject({ ok: false, reason: "server" });
    expect(JSON.stringify(result)).not.toMatch(/mysql|postgres|ECONNREFUSED|127\.0\.0\.1|localhost|nope/i);
  });
});

describe("admin actions", () => {
  async function signInAsAdmin() {
    await raw`insert into admins (id, email, password_hash) values (${randomUUID()}, 'boss@codernation.com', ${await m.password.hashPassword("a long enough password")}) on duplicate key update email = email`;
    const target = await redirectTarget(() => m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "a long enough password" })));
    expect(target).toBe("/admin");
    expect(cookieJar.get("cn_admin")).toBeTruthy();
  }

  it("login: wrong credentials say so generically; right ones set the session cookie and go to /admin", async () => {
    await raw`insert into admins (id, email, password_hash) values (${randomUUID()}, 'boss@codernation.com', ${await m.password.hashPassword("a long enough password")})`;
    expect(await m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "wrong wrong wrong" }))).toEqual({ error: "الإيميل أو الباسورد غلط" });
    expect(await m.admin.loginAction(null, form({ email: "ghost@codernation.com", password: "wrong wrong wrong" }))).toEqual({ error: "الإيميل أو الباسورد غلط" });
    expect(await m.admin.loginAction(null, form({ email: "", password: "" }))).toMatchObject({ error: expect.any(String) });
    expect(cookieJar.has("cn_admin")).toBe(false);
    await signInAsAdmin();
  });

  it("EVERY admin action refuses without a session, and changes nothing", async () => {
    const id = randomUUID();
    await raw`insert into leads (id, name, phone) values (${id}, 'أحمد', '+201000000001')`;
    expect(await redirectTarget(() => m.admin.updateLeadAction(null, form({ id, status: "closed", note: "hacked" })))).toBe("/admin/login");
    expect(await redirectTarget(() => m.admin.deleteLeadAction(form({ id })))).toBe("/admin/login");
    expect(await redirectTarget(() => m.admin.saveSettingsAction(null, form({ whatsappNumber: "201111111111" })))).toBe("/admin/login");
    expect(await raw`select status, note from leads where id = ${id}`).toEqual([{ status: "new", note: "" }]);
    expect(await raw`select 1 from settings`).toHaveLength(0);
    expect(updatedTags).toEqual([]);
  });

  it("an expired or forged cookie is no session either", async () => {
    cookieJar.set("cn_admin", "f".repeat(43));
    const id = randomUUID();
    await raw`insert into leads (id, name, phone) values (${id}, 'أحمد', '+201000000001')`;
    expect(await redirectTarget(() => m.admin.deleteLeadAction(form({ id })))).toBe("/admin/login");
    expect(await raw`select 1 from leads`).toHaveLength(1);
  });

  it("with a session: updates a lead, rejects a bad status, deletes", async () => {
    await signInAsAdmin();
    const id = randomUUID();
    await raw`insert into leads (id, name, phone) values (${id}, 'أحمد', '+201000000001')`;
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
    await raw`insert into leads (id, name, phone) values (${randomUUID()}, 'سري', '+201000000001')`;
    const { GET } = await import("@/app/(admin)/admin/(panel)/leads/export/route");
    expect(await redirectTarget(() => GET(request()))).toBe("/admin/login");
  });

  it("with a session it returns a BOM'd CSV of the leads, neutralizes formulas, and honours the filters", async () => {
    await raw`insert into admins (id, email, password_hash) values (${randomUUID()}, 'boss@codernation.com', ${await m.password.hashPassword("a long enough password")})`;
    await redirectTarget(() => m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "a long enough password" })));
    await raw`insert into leads (id, name, phone, message, status) values (${randomUUID()}, '=HYPERLINK("http://evil")', '+201000000001', 'a,b "c"', 'new'), (${randomUUID()}, 'عميل مغلق', '+201000000002', null, 'closed')`;
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

describe("page content: actions, image upload and the public image route", () => {
  const actions = () => import("@/app/(admin)/admin/(panel)/content/actions");
  const uploadRoute = () => import("@/app/(admin)/admin/(panel)/content/upload/route");
  const mediaRoute = () => import("@/app/media/[id]/route");
  const hero = async () => ((await import("@/lib/content-model")).defaultsFor("hero") as Record<string, unknown>);

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8];
  const upload = (parts: BlobPart[] | null, headers: Record<string, string> = {}, type = "image/png") => {
    const body = new FormData();
    if (parts) body.set("file", new File(parts, "shot.png", { type }));
    return new Request("http://localhost/admin/content/upload", { method: "POST", body, headers });
  };
  async function signIn() {
    await raw`insert into admins (id, email, password_hash) values (${randomUUID()}, 'boss@codernation.com', ${await m.password.hashPassword("a long enough password")}) on duplicate key update email = email`;
    await redirectTarget(() => m.admin.loginAction(null, form({ email: "boss@codernation.com", password: "a long enough password" })));
    expect(cookieJar.get("cn_admin")).toBeTruthy();
  }

  it("EVERY content action and the upload route refuse without a session, and change nothing", async () => {
    const { saveSectionAction, resetSectionAction, setSectionHiddenAction } = await actions();
    expect(await redirectTarget(async () => saveSectionAction("hero", await hero()))).toBe("/admin/login");
    expect(await redirectTarget(() => resetSectionAction("hero"))).toBe("/admin/login");
    expect(await redirectTarget(() => setSectionHiddenAction("work", true))).toBe("/admin/login");
    const { POST } = await uploadRoute();
    const response = await POST(upload([new Uint8Array(PNG)]));
    expect(response.status).toBe(401);
    expect(await raw`select 1 from settings`).toHaveLength(0);
    expect(await raw`select 1 from media`).toHaveLength(0);
    expect(updatedTags).toEqual([]);
  });

  it("with a session: saves a section and refreshes the site's cache; bad input gets field errors and nothing is saved", async () => {
    await signIn();
    const { saveSectionAction, resetSectionAction, setSectionHiddenAction } = await actions();
    const edited = { ...(await hero()), badge: "نستقبل مشاريع جديدة هذا الشهر" };
    expect(await saveSectionAction("hero", edited)).toEqual({ ok: true });
    expect(updatedTags).toEqual(["content"]);
    expect((await raw`select value from settings where name = 'content'`)[0].value).toMatchObject({ sections: { hero: { badge: "نستقبل مشاريع جديدة هذا الشهر" } } });

    updatedTags.length = 0;
    const bad = await saveSectionAction("hero", { ...edited, titleLead: "", primaryCta: { label: "x", href: "javascript:alert(1)" } });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { titleLead: expect.any(String), "primaryCta.href": expect.any(String) } });
    expect(updatedTags).toEqual([]);
    expect((await raw`select value from settings where name = 'content'`)[0].value).toMatchObject({ sections: { hero: { badge: "نستقبل مشاريع جديدة هذا الشهر" } } });

    expect(await saveSectionAction("../../etc/passwd", edited)).toMatchObject({ ok: false });
    expect(await saveSectionAction("__proto__", edited)).toMatchObject({ ok: false });
    expect(await setSectionHiddenAction("contact", true)).toMatchObject({ ok: false });
    expect(await setSectionHiddenAction("work", true)).toEqual({ ok: true });
    expect(await resetSectionAction("hero")).toEqual({ ok: true });
    expect((await raw`select value from settings where name = 'content'`)[0].value).toEqual({ sections: {}, hidden: ["work"] });
    expect(updatedTags.filter((tag) => tag === "content")).toHaveLength(2);
  });

  it("upload: takes a real image, refuses disguised files, big ones, other sites' requests and empty forms", async () => {
    await signIn();
    const { POST } = await uploadRoute();

    const ok = await POST(upload([new Uint8Array(PNG)]));
    expect(ok.status).toBe(200);
    const { id } = (await ok.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ok.headers.get("cache-control")).toBe("no-store");

    // A script renamed .png with an image type is still refused: the file's own bytes decide.
    const disguised = await POST(upload(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"]));
    expect(disguised.status).toBe(400);
    expect(await disguised.json()).toHaveProperty("error");

    const huge = await POST(upload([new Uint8Array(PNG)], { "content-length": String(10 * 1024 * 1024) }));
    expect(huge.status).toBe(413);

    const crossSite = await POST(upload([new Uint8Array(PNG)], { "sec-fetch-site": "cross-site" }));
    expect(crossSite.status).toBe(403);
    const sameSite = await POST(upload([new Uint8Array(PNG)], { "sec-fetch-site": "same-origin" }));
    expect(sameSite.status).toBe(200);

    expect((await POST(upload(null))).status).toBe(400);
    expect(await raw`select 1 from media`).toHaveLength(2); // only the two good uploads
  });

  it("the public image route: serves the stored bytes with long-lived caching and safe headers, 304s on a repeat, 404s on anything else", async () => {
    const { GET } = await mediaRoute();
    const id = randomUUID();
    await raw`insert into media (id, mime, data, size_bytes) values (${id}, 'image/png', ${Buffer.from(PNG)}, ${PNG.length})`;
    const get = (value: string, headers: Record<string, string> = {}) => GET(new Request(`http://localhost/media/${value}`, { headers }), { params: Promise.resolve({ id: value }) });

    const response = await get(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual(PNG);

    const repeat = await get(id, { "if-none-match": response.headers.get("etag") as string });
    expect(repeat.status).toBe(304);

    for (const bad of ["not-a-uuid", "00000000-0000-4000-8000-000000000000", "..%2F..%2Fetc%2Fpasswd", "1; drop table media"]) {
      expect((await get(bad)).status, bad).toBe(404);
    }
  });
});
