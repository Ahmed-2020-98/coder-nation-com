import "server-only";
import { connect, type Db } from "./sql";

export class DatabaseUnavailableError extends Error {
  constructor(message = "DATABASE_URL is not set") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

declare global {
  var __codernationSql: Db | undefined;
}

/** Lazy shared connection pool (kept on globalThis so dev hot reloads don't leak connections). MySQL / MariaDB. */
export function sql(): Db {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseUnavailableError();
  return (globalThis.__codernationSql ??= connect(url));
}

/** Tests only: drops the pool so the next sql() call connects to whatever DATABASE_URL is now. */
export async function closeDatabase(): Promise<void> {
  const pool = globalThis.__codernationSql;
  globalThis.__codernationSql = undefined;
  await pool?.end();
}
