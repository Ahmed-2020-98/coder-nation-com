import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Db } from "../src/server/sql";
import { clearTables, createTestDb, dropTestDb, type TestDb } from "./helpers/db";

// Integration tests against a throw-away MySQL database, created here and dropped at the end. They never touch
// any other database on the machine (the name is random and carries the prefix below).

const CTX = { ipHash: "iphash-test-1", userAgent: "vitest" };

type Mods = {
  db: typeof import("@/server/db");
  leads: typeof import("@/server/leads");
  auth: typeof import("@/server/auth-core");
  rate: typeof import("@/server/rate-limit");
  settings: typeof import("@/server/settings");
  password: typeof import("@/server/password");
};
const m = {} as Mods;
let raw: Db;
let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb("cn_site_test", { migrate: false });
  raw = testDb.raw;
  process.env.DATABASE_URL = testDb.url;
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  const { migrate } = await import("../db/migrate.mjs");
  expect(await migrate(raw)).toEqual(["001_init.sql", "002_media.sql"]);
  expect(await migrate(raw)).toEqual([]); // idempotent
  vi.resetModules();
  m.db = await import("@/server/db");
  m.leads = await import("@/server/leads");
  m.auth = await import("@/server/auth-core");
  m.rate = await import("@/server/rate-limit");
  m.settings = await import("@/server/settings");
  m.password = await import("@/server/password");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await dropTestDb(testDb);
});

beforeEach(async () => {
  await clearTables(raw, ["leads", "sessions", "admins", "rate_limits", "settings", "media"]);
});

const input = (over: Partial<import("@/server/leads").LeadInput> = {}) => ({
  name: "أحمد علي",
  phone: "+201000000001",
  email: null,
  service: "موقع إلكتروني",
  message: null,
  ...over,
});

describe("leads", () => {
  it("stores a lead with status 'new' and never the raw IP", async () => {
    const id = await m.leads.createLead(input({ message: "تفاصيل" }), { ipHash: "abc123", userAgent: "ua" });
    const lead = await m.leads.getLead(id);
    expect(lead).toMatchObject({ name: "أحمد علي", phone: "+201000000001", status: "new", note: "", message: "تفاصيل" });
    const [row] = await raw`select ip_hash, user_agent from leads where id = ${id}`;
    expect(row).toEqual({ ip_hash: "abc123", user_agent: "ua" });
  });

  it("the table itself refuses what the app should never send", async () => {
    await expect(raw`insert into leads (name, phone) values ('x', '+201000000001')`).rejects.toThrow();
    await expect(raw`insert into leads (name, phone, status) values ('أحمد', '+201000000001', 'hacked')`).rejects.toThrow();
  });

  it("filters by status, searches substrings (wildcards are plain characters) and paginates", async () => {
    for (let i = 1; i <= 30; i++) await m.leads.createLead(input({ name: `عميل ${i}`, phone: `+2010000${String(i).padStart(5, "0")}`, email: i === 7 ? "seven@example.com" : null }), { ipHash: null, userAgent: null });
    await m.leads.createLead(input({ name: "100% جاهز" }), { ipHash: null, userAgent: null });
    const all = await m.leads.listLeads({});
    expect(all).toMatchObject({ total: 31, page: 1, pages: 2 });
    expect(all.rows).toHaveLength(25);
    expect((await m.leads.listLeads({ page: 2 })).rows).toHaveLength(6);
    expect((await m.leads.listLeads({ page: 99 })).page).toBe(2); // clamped, not an empty page
    expect((await m.leads.listLeads({ q: "SEVEN@" })).total).toBe(1);
    expect((await m.leads.listLeads({ q: "00007" })).total).toBe(1);
    expect((await m.leads.listLeads({ q: "%" })).total).toBe(1); // only the name that really contains a percent sign
    expect((await m.leads.listLeads({ q: "_" })).total).toBe(0);
    expect((await m.leads.listLeads({ q: "' or 1=1 --" })).total).toBe(0);
    expect((await m.leads.listLeads({ status: "closed" })).total).toBe(0);
  });

  it("updates status/note, deletes, and counts", async () => {
    const id = await m.leads.createLead(input(), { ipHash: null, userAgent: null });
    await m.leads.createLead(input({ name: "تاني" }), { ipHash: null, userAgent: null });
    expect(await m.leads.updateLead(id, { status: "contacted", note: "كلمته" })).toBe(true);
    expect(await m.leads.getLead(id)).toMatchObject({ status: "contacted", note: "كلمته" });
    expect(await m.leads.leadStats()).toEqual({ total: 2, fresh: 1, week: 2 });
    expect(await m.leads.updateLead("00000000-0000-0000-0000-000000000000", { status: "closed", note: "" })).toBe(false);
    expect(await m.leads.deleteLead(id)).toBe(true);
    expect(await m.leads.deleteLead(id)).toBe(false);
    expect(await m.leads.getLead(id)).toBeNull();
    expect(await m.leads.getLead("not-a-uuid")).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows `limit` hits per window, then blocks, then recovers when the window passes", async () => {
    for (let i = 1; i <= 3; i++) expect((await m.rate.hit("k", 3, 60)).allowed, `hit ${i}`).toBe(true);
    const blocked = await m.rate.hit("k", 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await m.rate.hit("other", 3, 60)).allowed).toBe(true); // keys are independent
    await raw`update rate_limits set window_start = now(3) - interval 2 minute where name = 'k'`;
    expect(await m.rate.hit("k", 3, 60)).toMatchObject({ allowed: true, count: 1 });
    await m.rate.resetLimit("k");
    expect(await m.rate.hit("k", 3, 60)).toMatchObject({ count: 1 });
  });

  it("counts correctly under concurrency (one atomic upsert)", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => m.rate.hit("race", 4, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
  });
});

describe("sign-in and sessions", () => {
  async function seedAdmin(email = "boss@codernation.com", password = "a long enough password") {
    await raw`insert into admins (id, email, password_hash) values (${randomUUID()}, ${email}, ${await m.password.hashPassword(password)})`;
    return { email, password };
  }

  it("a right password gives a session whose token resolves to the admin; only its hash is stored", async () => {
    const { email, password } = await seedAdmin();
    const result = await m.auth.signIn("  BOSS@codernation.com ", password, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    expect(await m.auth.adminFromToken(result.token)).toMatchObject({ email });
    const stored = await raw`select token_hash from sessions`;
    expect(stored).toHaveLength(1);
    expect(stored[0].token_hash).not.toBe(result.token);
    expect(JSON.stringify(stored)).not.toContain(result.token);
    const [admin] = await raw`select last_login_at from admins`;
    expect(admin.last_login_at).not.toBeNull();
  });

  it("wrong password and unknown email look the same, and neither creates a session", async () => {
    await seedAdmin();
    expect(await m.auth.signIn("boss@codernation.com", "nope nope nope nope", CTX)).toEqual({ ok: false, reason: "invalid" });
    expect(await m.auth.signIn("ghost@codernation.com", "a long enough password", CTX)).toEqual({ ok: false, reason: "invalid" });
    expect(await raw`select 1 from sessions`).toHaveLength(0);
  });

  it("locks after 5 failures, even for the right password, and a success resets the counter", async () => {
    const { password } = await seedAdmin();
    for (let i = 0; i < 4; i++) expect((await m.auth.signIn("boss@codernation.com", "bad bad bad bad", CTX)).ok).toBe(false);
    expect((await m.auth.signIn("boss@codernation.com", password, CTX)).ok).toBe(true); // 5th attempt is still allowed, and resets
    for (let i = 0; i < 5; i++) await m.auth.signIn("boss@codernation.com", "bad bad bad bad", CTX);
    const locked = await m.auth.signIn("boss@codernation.com", password, CTX);
    expect(locked).toMatchObject({ ok: false, reason: "limited" });
    expect((locked as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    // another visitor is unaffected
    expect((await m.auth.signIn("boss@codernation.com", password, { ipHash: "someone-else", userAgent: null })).ok).toBe(true);
  });

  it("rejects expired, forged and signed-out tokens", async () => {
    const { password } = await seedAdmin();
    const result = await m.auth.signIn("boss@codernation.com", password, CTX);
    if (!result.ok) throw new Error("sign-in failed");
    await raw`update sessions set expires_at = now(3) - interval 1 second`;
    expect(await m.auth.adminFromToken(result.token)).toBeNull();
    expect(await m.auth.adminFromToken("x".repeat(43))).toBeNull();
    expect(await m.auth.adminFromToken("short")).toBeNull();
    expect(await m.auth.adminFromToken("")).toBeNull();

    const again = await m.auth.signIn("boss@codernation.com", password, { ipHash: "another", userAgent: null });
    if (!again.ok) throw new Error("sign-in failed");
    expect(await m.auth.adminFromToken(again.token)).not.toBeNull();
    await m.auth.signOut(again.token);
    expect(await m.auth.adminFromToken(again.token)).toBeNull();
  });

  it("deleting an admin deletes their sessions", async () => {
    const { password } = await seedAdmin();
    await m.auth.signIn("boss@codernation.com", password, CTX);
    await raw`delete from admins`;
    expect(await raw`select 1 from sessions`).toHaveLength(0);
  });
});

describe("settings", () => {
  it("reads the defaults before anything is saved, then what was written, then survives a corrupted row", async () => {
    expect(await m.settings.readSettings()).toEqual(m.settings.DEFAULT_SETTINGS);
    const next = { ...m.settings.DEFAULT_SETTINGS, whatsappNumber: "201234567890", ecosystem: { marketing: true, sales: false, crm: false } };
    await m.settings.writeSettings(next);
    await m.settings.writeSettings(next); // upsert, not a duplicate-key error
    expect(await m.settings.readSettings()).toEqual(next);
    expect(await raw`select 1 from settings`).toHaveLength(1);
    await raw`update settings set value = ${raw.json({ whatsappNumber: 5, email: "<script>" })}`;
    expect(await m.settings.readSettings()).toEqual(m.settings.DEFAULT_SETTINGS);
  });
});
