import "server-only";
import { sql } from "./db";

export type RateResult = { allowed: boolean; count: number; retryAfterSeconds: number };

/**
 * Fixed-window counter in Postgres (one atomic upsert, works across serverless instances).
 * Counts this call, then says whether it is still within `limit` for the current window.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateResult> {
  const db = sql();
  const [row] = await db<{ count: number; retry: number }[]>`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count, greatest(0, ceil(extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int as retry`;
  // Housekeeping on ~1% of calls so the table cannot grow forever.
  if (Math.random() < 0.01) void db`delete from rate_limits where window_start < now() - interval '1 day'`.catch(() => {});
  return { allowed: row.count <= limit, count: row.count, retryAfterSeconds: row.retry };
}

export async function resetLimit(key: string): Promise<void> {
  await sql()`delete from rate_limits where key = ${key}`;
}
