import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Role } from "@/lib/crm-rules";
import { sql } from "./db";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "./password";
import { hit, resetLimit } from "./rate-limit";

/**
 * Sign-in and session storage, with no dependency on Next's request APIs (so it can be tested directly).
 * The browser keeps a random token; the database keeps only its SHA-256.
 */

export const SESSION_DAYS = 7;
export const LOGIN_LIMIT = { attempts: 5, windowSeconds: 15 * 60 };
const IP_LIMIT = { attempts: 30, windowSeconds: 15 * 60 };

export type SessionUser = { id: string; email: string; name: string; role: Role; mustChangePassword: boolean };
export type SignInResult =
  | { ok: true; token: string; expiresAt: Date; mustChangePassword: boolean }
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
  const [user] = await db<{ id: string; password_hash: string; active: boolean; must_change_password: boolean }[]>`
    select id, password_hash, active, must_change_password from users where email = ${email}`;
  // Always run one scrypt, even for an unknown email, so response time doesn't reveal which emails exist.
  const valid = await verifyPassword(password.slice(0, 200), user?.password_hash ?? (await dummyHash()));
  // A suspended account gets the same answer as a wrong password.
  if (!user || !valid || !user.active) return { ok: false, reason: "invalid" };

  await resetLimit(perAccount);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db`insert into sessions (id, user_id, token_hash, expires_at, user_agent) values (${randomUUID()}, ${user.id}, ${sha256(token)}, ${expiresAt}, ${context.userAgent})`;
  await db`update users set last_login_at = now(3) where id = ${user.id}`;
  await db`delete from sessions where expires_at < now(3)`;
  return { ok: true, token, expiresAt, mustChangePassword: user.must_change_password };
}

export async function userFromToken(token: string): Promise<SessionUser | null> {
  if (token.length < 20 || token.length > 100) return null;
  const [row] = await sql()<{ id: string; email: string; name: string; role: Role; must_change_password: boolean }[]>`
    select u.id, u.email, u.name, u.role, u.must_change_password
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now(3) and u.active`;
  return row ? { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: row.must_change_password } : null;
}

export async function signOut(token: string): Promise<void> {
  await sql()`delete from sessions where token_hash = ${sha256(token)}`;
}

export type PasswordChange = { ok: true } | { ok: false; error: string };

/** Changes the password after checking the current one, and signs every OTHER session of that user out. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepToken: string | null): Promise<PasswordChange> {
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, error: problem };
  const db = sql();
  const [user] = await db<{ password_hash: string }[]>`select password_hash from users where id = ${userId} and active`;
  if (!user || !(await verifyPassword(currentPassword.slice(0, 200), user.password_hash))) return { ok: false, error: "الباسورد الحالي غلط" };
  if (currentPassword === newPassword) return { ok: false, error: "الباسورد الجديد لازم يختلف عن الحالي" };
  const hash = await hashPassword(newPassword);
  await db.begin(async (tx) => {
    await tx`update users set password_hash = ${hash}, must_change_password = false where id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId} and token_hash <> ${keepToken ? sha256(keepToken) : ""}`;
  });
  return { ok: true };
}
