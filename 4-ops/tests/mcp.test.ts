import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/server/sql";
import { clearTables, createTestDb, dropTestDb, withId, type TestDb } from "./helpers/db";

// The MCP endpoint end to end: real JSON-RPC requests to the route handler, on a throw-away database. The point: a
// key acts as exactly its owner (same permissions as in the app), dead keys get nothing, writes are logged, and no
// password ever comes back through it.

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("next/cache", () => ({ refresh: () => {}, updateTag: () => {} }));
vi.mock("next/navigation", () => ({
  // The same error shape Next throws: the MCP layer reads the target from its digest.
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${to};307;` });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));
vi.mock("@/server/pdf", () => ({ PdfError: class PdfError extends Error {} }));

type Mods = {
  db: typeof import("@/server/db");
  tokens: typeof import("@/server/api-tokens");
  route: typeof import("@/app/api/mcp/route");
  password: typeof import("@/server/password");
};
const m = {} as Mods;
let raw: Db;
let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb("cn_ops_mcp");
  raw = testDb.raw;
  process.env.DATABASE_URL = testDb.url;
  process.env.IP_HASH_SALT = "test-salt-test-salt-test-salt";
  vi.resetModules();
  m.db = await import("@/server/db");
  m.tokens = await import("@/server/api-tokens");
  m.route = await import("@/app/api/mcp/route");
  m.password = await import("@/server/password");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await dropTestDb(testDb);
});

beforeEach(async () => {
  await clearTables(raw, ["mcp_calls", "api_tokens", "invoices", "invoice_counters", "client_contracts", "client_contract_counters", "activities", "follow_ups", "proposal_milestones", "proposal_items", "proposals", "proposal_counters", "deals", "contacts", "clients", "rate_limits", "sessions", "users"]);
});

async function person(role: "owner" | "manager" | "employee", extra: { active?: boolean; must?: boolean } = {}) {
  const email = `${role}-${Math.random().toString(36).slice(2, 7)}@x.com`;
  const [row] = await withId(async (id) => raw`
    insert into users (id, email, name, role, password_hash, active, must_change_password)
    values (${id}, ${email}, ${role + " user"}, ${role}, ${await m.password.hashPassword("a long enough password")}, ${extra.active ?? true}, ${extra.must ?? false})`);
  const made = await m.tokens.createToken(row.id, `key of ${role}`, 90);
  if (!made.ok) throw new Error(made.error);
  return { id: row.id, key: made.token, tokenId: made.id };
}

let nextId = 1;
type RpcBody = { result?: { isError?: boolean; content?: { text: string }[]; tools?: { name: string; annotations?: { readOnlyHint?: boolean } }[] } };

async function rpc(key: string | null, method: string, params: Record<string, unknown> = {}): Promise<{ status: number; body: RpcBody | null }> {
  const response = await m.route.POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
  );
  if (response.status !== 200) return { status: response.status, body: null };
  const text = await response.text();
  // The answer comes either as plain JSON or as one SSE "data:" line.
  const json = text.trimStart().startsWith("{") ? JSON.parse(text) : JSON.parse(text.split("\n").find((line) => line.startsWith("data: "))!.slice(6));
  return { status: 200, body: json as RpcBody };
}

async function call(key: string, name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc(key, "tools/call", { name, arguments: args });
  const result = body!.result!;
  const text = result.content![0].text;
  return { error: result.isError ? text : null, data: result.isError ? null : (JSON.parse(text) as Record<string, unknown>) };
}

describe("MCP keys", () => {
  it("stores only a hash of the key, and shows the key once", async () => {
    const owner = await person("owner");
    expect(owner.key).toMatch(/^cno_[A-Za-z0-9_-]{43}$/);
    const [row] = await raw<{ token_hash: string; prefix: string }[]>`select token_hash, prefix from api_tokens where id = ${owner.tokenId}`;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(owner.key.slice(4, 20));
    expect(row.prefix).toBe(owner.key.slice(0, 8));
    expect(await m.tokens.createToken(owner.id, "x", 90)).toMatchObject({ ok: false });
    expect(await m.tokens.createToken(owner.id, "مفتاح", 7)).toMatchObject({ ok: false });
  });

  it("turns away a missing, wrong, revoked or expired key, and the key of a disabled or not-yet-set-up account", async () => {
    const owner = await person("owner");
    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc("cno_" + "x".repeat(43), "tools/list")).status).toBe(401);
    expect((await rpc(owner.key, "tools/list")).status).toBe(200);

    await m.tokens.revokeToken(owner.tokenId);
    expect((await rpc(owner.key, "tools/list")).status).toBe(401);

    const late = await person("owner");
    await raw`update api_tokens set expires_at = now(3) - interval 1 minute where id = ${late.tokenId}`;
    expect((await rpc(late.key, "tools/list")).status).toBe(401);

    const disabled = await person("manager", { active: false });
    expect((await rpc(disabled.key, "tools/list")).status).toBe(401);
    const fresh = await person("employee", { must: true });
    expect((await rpc(fresh.key, "tools/list")).status).toBe(401);
  });

  it("offers every module's tools, and marks the read-only ones", async () => {
    const owner = await person("owner");
    const tools = (await rpc(owner.key, "tools/list")).body!.result!.tools!;
    const names = tools.map((t) => t.name);
    for (const name of ["whoami", "create_deal", "save_proposal", "create_task", "attendance_month", "create_client_contract", "record_payment", "void_invoice", "create_user"]) expect(names).toContain(name);
    expect(names).not.toContain("reset_password");
    expect(tools.find((t) => t.name === "list_deals")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === "create_deal")?.annotations?.readOnlyHint).toBe(false);
  });
});

describe("MCP tools act as the key's owner", () => {
  it("writes through the app's own rules, and logs every write and refusal", async () => {
    const owner = await person("owner");
    const created = await call(owner.key, "create_deal", { title: "موقع شركة", clientName: "شركة النور", clientPhone: "٠١٠١٢٣٤٥٦٧٨", value: "15,000", currency: "EGP" });
    expect(created.error).toBeNull();
    const dealId = created.data!.dealId as string;
    const deal = await call(owner.key, "get_deal", { dealId });
    expect(deal.data).toMatchObject({ title: "موقع شركة", clientName: "شركة النور", stage: "new", value: { amountMinor: 1_500_000 } });

    // The app's own validation message comes back as the tool's error.
    expect((await call(owner.key, "move_deal", { dealId, stage: "lost" })).error).toContain("سبب");
    expect((await call(owner.key, "move_deal", { dealId, stage: "meeting" })).error).toBeNull();
    expect((await call(owner.key, "create_deal", { title: "x" })).error).toBeTruthy();

    const log = await raw<{ tool: string; ok: number }[]>`select tool, ok from mcp_calls order by id`;
    expect(log.map((r) => [r.tool, Boolean(r.ok)])).toEqual([
      ["create_deal", true],
      ["move_deal", false],
      ["move_deal", true],
      ["create_deal", false],
    ]);
    // Reads are not logged.
    expect(log.some((r) => r.tool === "get_deal")).toBe(false);
  });

  it("an employee's key sees only their own deals and can't reach what their role can't", async () => {
    const owner = await person("owner");
    const employee = await person("employee");
    const dealId = (await call(owner.key, "create_deal", { title: "صفقة المالك", clientName: "عميل" })).data!.dealId as string;
    expect((await call(employee.key, "list_deals")).data).toEqual([]);
    expect((await call(employee.key, "get_deal", { dealId })).error).toContain("ليست مسندة");
    expect((await call(employee.key, "move_deal", { dealId, stage: "won" })).error).toBeTruthy();
    expect((await call(employee.key, "list_clients")).error).toContain("client.manage");
    expect((await call(employee.key, "create_user", { email: "a@b.co", name: "اسم", role: "owner" })).error).toBeTruthy();
    expect(await raw`select id from users where email = 'a@b.co'`).toHaveLength(0);

    // Once assigned to them, it is theirs to see.
    expect((await call(owner.key, "assign_deal", { dealId, ownerId: employee.id })).error).toBeNull();
    expect((await call(employee.key, "get_deal", { dealId })).data).toMatchObject({ title: "صفقة المالك" });
  });

  it("creates an account without ever returning a password", async () => {
    const owner = await person("owner");
    const result = await call(owner.key, "create_user", { email: "New.Person@X.com", name: "شخص جديد", role: "employee" });
    expect(result.error).toBeNull();
    expect(JSON.stringify(result.data)).not.toMatch(/باسورد المؤقت|password":/i);
    const [row] = await raw<{ must_change_password: number }[]>`select must_change_password from users where email = 'new.person@x.com'`;
    expect(Boolean(row.must_change_password)).toBe(true);
    // An account can't change its own role or switch itself off.
    expect((await call(owner.key, "set_user_active", { userId: owner.id, active: false })).error).toBeTruthy();
  });

  it("only the owner voids an invoice; a manager's key is refused", async () => {
    const manager = await person("manager");
    const owner = await person("owner");
    const fakeId = "00000000-0000-4000-8000-000000000000";
    expect((await call(manager.key, "void_invoice", { invoiceId: fakeId, reason: "غلط" })).error).toContain("invoice.void");
    expect((await call(owner.key, "void_invoice", { invoiceId: fakeId, reason: "غلط" })).error).toContain("مش موجودة");
  });
});
