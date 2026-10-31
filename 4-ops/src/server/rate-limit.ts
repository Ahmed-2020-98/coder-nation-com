import "server-only";
import { sql } from "./db";

export type RateResult = { allowed: boolean; count: number; retryAfterSeconds: number };

/**
 * Fixed-window counter in the database (works across serverless instances).
 * Counts this call, then says whether it is still within `limit` for the current window.
 *
 * The upsert is one atomic statement. In an UPDATE list MySQL applies the assignments left to right, so `hits` is
 * decided from the old window_start before window_start itself is moved: keep them in this order.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateResult> {
  const db = sql();
  const row = await db.begin(async (tx) => {
    await tx`
      insert into rate_limits (name, hits, window_start) values (${key}, 1, now(3))
      on duplicate key update
        hits = if(window_start <= now(3) - interval ${windowSeconds} second, 1, hits + 1),
        window_start = if(window_start <= now(3) - interval ${windowSeconds} second, now(3), window_start)`;
    const [counter] = await tx<{ hits: number; window_start: Date }[]>`select hits, window_start from rate_limits where name = ${key}`;
    return counter;
  });
  // Housekeeping on ~1% of calls so the table cannot grow forever.
  if (Math.random() < 0.01) void db`delete from rate_limits where window_start < now(3) - interval 1 day`.catch(() => {});
  const retry = Math.max(0, Math.ceil((row.window_start.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
  return { allowed: row.hits <= limit, count: row.hits, retryAfterSeconds: retry };
}

export async function resetLimit(key: string): Promise<void> {
  await sql()`delete from rate_limits where name = ${key}`;
}
