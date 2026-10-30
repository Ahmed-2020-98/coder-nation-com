// Applies db/migrations/*.sql in name order, each inside a transaction, and remembers what ran.
// Shared by `npm run db:migrate` and the integration tests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** @param {import("postgres").Sql} sql @returns {Promise<string[]>} names applied by this call */
export async function migrate(sql) {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((row) => row.name));
  const applied = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    applied.push(file);
  }
  return applied;
}
