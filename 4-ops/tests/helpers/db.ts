import { randomUUID } from "node:crypto";
import { connect, type Db } from "../../src/server/sql";
import { migrate } from "../../db/migrate.mjs";

// Throw-away MySQL databases for the integration tests: created here, dropped at the end. The name is random and carries
// the prefix, so these tests never touch any other database on the machine.

export const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/mysql";

export type TestDb = { name: string; url: string; raw: Db };

export async function createTestDb(prefix: string, options: { migrate?: boolean } = {}): Promise<TestDb> {
  const name = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = connect(ADMIN_URL, { connectionLimit: 1 });
  await admin`create database ${admin.unsafe(name)} character set utf8mb4 collate utf8mb4_unicode_ci`;
  await admin.end();
  const url = ADMIN_URL.replace(/\/[^/]*$/, `/${name}`);
  const raw = connect(url, { connectionLimit: 3, multipleStatements: true });
  if (options.migrate !== false) await migrate(raw);
  return { name, url, raw };
}

export async function dropTestDb(db: TestDb | undefined): Promise<void> {
  if (!db) return;
  await db.raw.end();
  const admin = connect(ADMIN_URL, { connectionLimit: 1 });
  await admin`drop database if exists ${admin.unsafe(db.name)}`;
  await admin.end();
}

/** Empties tables (children first when there are foreign keys). */
export async function clearTables(raw: Db, tables: string[]): Promise<void> {
  for (const table of tables) await raw`delete from ${raw.unsafe(table)}`;
}

/** Stands in for Postgres' `insert ... returning id`: runs `run` with a fresh id and hands the id back as one row. */
export async function withId(run: (id: string) => PromiseLike<unknown>): Promise<{ id: string }[]> {
  const id = randomUUID();
  await run(id);
  return [{ id }];
}
