// Applies a list of migrations (name + SQL) to a database and remembers what ran in `schema_migrations`.
// Used by `npm run db:migrate`, the tests and the start-up hook (src/instrumentation.ts). No file access here.
//
// MySQL commits every CREATE/ALTER by itself, so a migration cannot be rolled back half-way: keep each file small and
// recorded in schema_migrations only after it ran completely. `sql` must come from a connection that allows
// multiple statements in one query.

import type { Db } from "./sql";

export type Migration = { name: string; sql: string };

export async function applyMigrations(sql: Db, list: readonly Migration[]): Promise<string[]> {
  await sql`create table if not exists schema_migrations (name varchar(200) not null primary key, applied_at datetime(3) not null default current_timestamp(3)) default charset utf8mb4`;
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name));
  const applied: string[] = [];
  for (const migration of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(migration.name)) continue;
    await sql`${sql.unsafe(migration.sql)}`;
    await sql`insert into schema_migrations (name) values (${migration.name})`;
    applied.push(migration.name);
  }
  return applied;
}
