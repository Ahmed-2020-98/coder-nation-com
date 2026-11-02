import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Role } from "@/lib/crm-rules";
import type { SessionUser } from "./auth-core";
import { sql } from "./db";

// Keys for the MCP endpoint. A key is "cno_" + 32 random bytes; only its SHA-256 is stored, the key itself is shown
// once. Whoever holds a key acts as its owner (same role, same permissions), so a key stops working as soon as the
// owner's account is disabled, must change its password, or the key is revoked or expires.

const PREFIX = "cno_";
export const TOKEN_DAYS = [30, 90, 365] as const;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type ApiToken = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type TokenUser = SessionUser & { tokenId: string };

/** A new key for `userId`. Returns the key itself: the only time it exists outside the caller's hands. */
export async function createToken(userId: string, name: string, days: number): Promise<{ ok: true; token: string; id: string } | { ok: false; error: string }> {
  const label = name.trim();
  if (label.length < 2 || label.length > 80) return { ok: false, error: "اسم المفتاح من حرفين لـ 80 حرف" };
  if (!(TOKEN_DAYS as readonly number[]).includes(days)) return { ok: false, error: "مدة غير صالحة" };
  const token = PREFIX + randomBytes(32).toString("base64url");
  const id = randomUUID();
  await sql()`
    insert into api_tokens (id, user_id, name, token_hash, prefix, expires_at)
    values (${id}, ${userId}, ${label}, ${sha256(token)}, ${token.slice(0, 8)}, now(3) + interval ${days} day)`;
  return { ok: true, token, id };
}

type TokenRow = { id: string; user_id: string; user_name: string; name: string; prefix: string; created_at: Date; last_used_at: Date | null; expires_at: Date; revoked_at: Date | null };

export async function listTokens(): Promise<ApiToken[]> {
  const rows = await sql()<TokenRow[]>`
    select t.id, t.user_id, u.name as user_name, t.name, t.prefix, t.created_at, t.last_used_at, t.expires_at, t.revoked_at
    from api_tokens t join users u on u.id = t.user_id order by t.created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, userId: r.user_id, userName: r.user_name, name: r.name, prefix: r.prefix, createdAt: r.created_at, lastUsedAt: r.last_used_at, expiresAt: r.expires_at, revokedAt: r.revoked_at }));
}

export async function revokeToken(id: string): Promise<boolean> {
  const result = await sql()`update api_tokens set revoked_at = now(3) where id = ${id} and revoked_at is null`;
  return result.count > 0;
}

/** The person a key acts as, or null for anything that isn't a live key of an active account. */
export async function userFromApiToken(raw: string | null | undefined): Promise<TokenUser | null> {
  const token = raw?.trim() ?? "";
  if (!token.startsWith(PREFIX) || token.length < 40 || token.length > 100) return null;
  const db = sql();
  const [row] = await db<{ token_id: string; last_used_at: Date | null; id: string; email: string; name: string; role: Role; must_change_password: boolean }[]>`
    select t.id as token_id, t.last_used_at, u.id, u.email, u.name, u.role, u.must_change_password
    from api_tokens t join users u on u.id = t.user_id
    where t.token_hash = ${sha256(token)} and t.revoked_at is null and t.expires_at > now(3) and u.active`;
  // An account that must change its password is not fully set up: its keys wait until it is.
  if (!row || row.must_change_password) return null;
  // At most one write a minute per key, however busy the client is.
  if (!row.last_used_at || Date.now() - row.last_used_at.getTime() > 60_000) {
    await db`update api_tokens set last_used_at = now(3) where id = ${row.token_id}`;
  }
  return { tokenId: row.token_id, id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: false };
}

/** One line in the review log: a tool that changes something, or any call that was refused. Never fails the call. */
export async function logCall(tokenId: string, tool: string, ok: boolean, error?: string): Promise<void> {
  await sql()`insert into mcp_calls (token_id, tool, ok, error) values (${tokenId}, ${tool.slice(0, 80)}, ${ok}, ${error ? error.slice(0, 300) : null})`.catch(() => undefined);
}

export type McpCall = { tool: string; ok: boolean; error: string | null; createdAt: Date; tokenName: string; userName: string };

export async function recentCalls(limit = 100): Promise<McpCall[]> {
  const rows = await sql()<{ tool: string; ok: boolean; error: string | null; created_at: Date; token_name: string; user_name: string }[]>`
    select c.tool, c.ok, c.error, c.created_at, t.name as token_name, u.name as user_name
    from mcp_calls c join api_tokens t on t.id = c.token_id join users u on u.id = t.user_id
    order by c.id desc limit ${limit}`;
  return rows.map((r) => ({ tool: r.tool, ok: Boolean(r.ok), error: r.error, createdAt: r.created_at, tokenName: r.token_name, userName: r.user_name }));
}
