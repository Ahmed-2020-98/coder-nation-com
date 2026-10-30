import "server-only";
import postgres, { type Sql } from "postgres";

export class DatabaseUnavailableError extends Error {
  constructor(message = "DATABASE_URL is not set") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

declare global {
  var __codernationSql: Sql | undefined;
}

/** Lazy shared connection pool (kept on globalThis so dev hot reloads don't leak connections). */
export function sql(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseUnavailableError();
  return (globalThis.__codernationSql ??= postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 5,
    // Works behind connection poolers (Neon/pgbouncer) too.
    prepare: false,
    onnotice: () => {},
  }));
}

/** Tests only: drops the pool so the next sql() call connects to whatever DATABASE_URL is now. */
export async function closeDatabase(): Promise<void> {
  const pool = globalThis.__codernationSql;
  globalThis.__codernationSql = undefined;
  await pool?.end({ timeout: 5 });
}
