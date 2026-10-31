import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "./db";
import { dummyHash, verifyPassword } from "./password";
import { hit, resetLimit } from "./rate-limit";

/**
 * Sign-in and session storage, with no dependency on Next's request APIs (so it can be tested directly).
 * The browser keeps a random token; the database keeps only its SHA-256.
 */

export const SESSION_DAYS = 7;
export const LOGIN_LIMIT = { attempts: 5, windowSeconds: 15 * 60 };
const IP_LIMIT = { attempts: 30, windowSeconds: 15 * 60 };

export type Admin = { id: string; email: string };
export type SignInResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "limited"; retryAfterSeconds?: number };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 254);
}

export async function signIn(
  rawEmail: string,
  password: string,
  context: { ipHash: string; userAgent: string | null },
): Promise<SignInResult> {
  const email = normalizeEmail(rawEmail);
  // Two counters: one per (address, email) to stop guessing a password, one per address to stop trying many emails.
  const perAccount = `login:${context.ipHash}:${sha256(email).slice(0, 16)}`;
  const [account, address] = await Promise.all([
    hit(perAccount, LOGIN_LIMIT.attempts, LOGIN_LIMIT.windowSeconds),
    hit(`login-ip:${context.ipHash}`, IP_LIMIT.attempts, IP_LIMIT.windowSeconds),
  ]);
  if (!account.allowed || !address.allowed) {
    return { ok: false, reason: "limited", retryAfterSeconds: Math.max(account.retryAfterSeconds, address.retryAfterSeconds) };
  }

  const db = sql();
  const [admin] = await db<{ id: string; password_hash: string }[]>`select id, password_hash from admins where email = ${email}`;
  // Always run one scrypt, even for an unknown email, so response time doesn't reveal which emails exist.
  const valid = await verifyPassword(password.slice(0, 200), admin?.password_hash ?? (await dummyHash()));
  if (!admin || !valid) return { ok: false, reason: "invalid" };

  await resetLimit(perAccount);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db`insert into sessions (id, admin_id, token_hash, expires_at, user_agent) values (${randomUUID()}, ${admin.id}, ${sha256(token)}, ${expiresAt}, ${context.userAgent})`;
  await db`update admins set last_login_at = now(3) where id = ${admin.id}`;
  await db`delete from sessions where expires_at < now(3)`;
  return { ok: true, token, expiresAt };
}

export async function adminFromToken(token: string): Promise<Admin | null> {
  if (token.length < 20 || token.length > 100) return null;
  const [row] = await sql()<Admin[]>`
    select a.id, a.email from sessions s join admins a on a.id = s.admin_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now(3)`;
  return row ?? null;
}

export async function signOut(token: string): Promise<void> {
  await sql()`delete from sessions where token_hash = ${sha256(token)}`;
}
