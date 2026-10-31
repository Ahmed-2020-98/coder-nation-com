// Applies db/migrations/*.sql in name order and remembers what ran.
// Shared by `npm run db:migrate` and the integration tests.
//
// MySQL commits every CREATE/ALTER by itself, so a migration cannot be rolled back half-way: keep each file small and
// recorded in schema_migrations only after it ran completely. Pass a Db made with { multipleStatements: true }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** @param {import("../src/server/sql.ts").Db} sql @returns {Promise<string[]>} names applied by this call */
export async function migrate(sql) {
  await sql`create table if not exists schema_migrations (name varchar(200) not null primary key, applied_at datetime(3) not null default current_timestamp(3)) default charset utf8mb4`;
  const done = new Set((await sql`select name from schema_migrations`).map((row) => row.name));
  const applied = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql`${sql.unsafe(fs.readFileSync(path.join(dir, file), "utf8"))}`;
    await sql`insert into schema_migrations (name) values (${file})`;
    applied.push(file);
  }
  return applied;
}
