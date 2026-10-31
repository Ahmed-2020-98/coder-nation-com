import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MIGRATIONS } from "../src/server/migrations.generated";
import type { Db } from "../src/server/sql";
import { createTestDb, dropTestDb, type TestDb } from "./helpers/db";

// The server applies its own migrations at start-up (RUN_MIGRATIONS_ON_START=1), for hosts whose database cannot be
// reached from outside. The SQL it uses is a generated copy of db/migrations, so it must never drift from the files.

let testDb: TestDb;
let raw: Db;
const saved = { url: process.env.DATABASE_URL, flag: process.env.RUN_MIGRATIONS_ON_START, runtime: process.env.NEXT_RUNTIME };

beforeAll(async () => {
  testDb = await createTestDb("cn_ops_test", { migrate: false }); // empty database: no tables yet
  raw = testDb.raw;
});

afterAll(async () => {
  for (const [key, value] of [["DATABASE_URL", saved.url], ["RUN_MIGRATIONS_ON_START", saved.flag], ["NEXT_RUNTIME", saved.runtime]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await dropTestDb(testDb);
});

describe("start-up migrations", () => {
  it("the generated list is the same as db/migrations/*.sql", () => {
    const dir = path.join(__dirname, "..", "db", "migrations");
    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
    expect(MIGRATIONS.map((m) => m.name)).toEqual(files);
    for (const m of MIGRATIONS) expect(m.sql, m.name).toBe(fs.readFileSync(path.join(dir, m.name), "utf8"));
  });

  it("does nothing unless it is switched on", async () => {
    process.env.DATABASE_URL = testDb.url;
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.RUN_MIGRATIONS_ON_START;
    const { register } = await import("../src/instrumentation");
    await register();
    expect(await raw`show tables like 'schema_migrations'`).toHaveLength(0);
  });

  it("creates every table when switched on, and a second start changes nothing", async () => {
    process.env.RUN_MIGRATIONS_ON_START = "1";
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { register } = await import("../src/instrumentation");
    await register();
    expect((await raw<{ name: string }[]>`select name from schema_migrations order by name`).map((r) => r.name)).toEqual(MIGRATIONS.map((m) => m.name));
    for (const table of "users, deals, proposals, tasks, attendance".split(", ")) expect(await raw`show tables like ${table}`, table).toHaveLength(1);
    await register(); // again: nothing to apply, no error
    expect(await raw`select 1 from schema_migrations`).toHaveLength(MIGRATIONS.length);
    vi.restoreAllMocks();
  });
});
