import "server-only";
import { randomBytes } from "node:crypto";
import { EMAIL_RE, ROLES, type Role } from "@/lib/crm-rules";
import { sql } from "./db";
import { hashPassword } from "./password";
import { normalizeEmail } from "./auth-core";

export type TeamUser = { id: string; email: string; name: string; role: Role; active: boolean; mustChangePassword: boolean; lastLoginAt: Date | null; createdAt: Date };

export async function listUsers(): Promise<TeamUser[]> {
  const rows = await sql()<
    { id: string; email: string; name: string; role: Role; active: boolean; must_change_password: boolean; last_login_at: Date | null; created_at: Date }[]
  >`select id, email, name, role, active, must_change_password, last_login_at, created_at from users order by created_at`;
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, active: r.active, mustChangePassword: r.must_change_password, lastLoginAt: r.last_login_at, createdAt: r.created_at }));
}

/** Active users who can own deals (everyone who can log in). */
export async function listAssignableUsers(): Promise<{ id: string; name: string }[]> {
  return sql()<{ id: string; name: string }[]>`select id, name from users where active order by name`;
}

/** 18 random characters from an unambiguous alphabet (no 0/O/1/l/I): shown once to the owner, who hands it over. */
export function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(18);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export type UserResult = { ok: true; temporaryPassword?: string } | { ok: false; error: string };

export async function createUser(input: { email: string; name: string; role: Role }): Promise<UserResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "إيميل غير صحيح" };
  if (name.length < 2 || name.length > 80) return { ok: false, error: "الاسم من حرفين لـ 80 حرف" };
  if (!(ROLES as readonly string[]).includes(input.role)) return { ok: false, error: "دور غير صالح" };
  const password = temporaryPassword();
  try {
    await sql()`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${name}, ${input.role}, ${await hashPassword(password)}, true)`;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "الإيميل ده مسجّل قبل كده" };
    throw error;
  }
  return { ok: true, temporaryPassword: password };
}

/** At least one active owner must always remain, or nobody could manage users again. */
async function otherActiveOwners(userId: string): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`select count(*)::int as n from users where role = 'owner' and active and id <> ${userId}`;
  return row.n;
}

export async function setActive(userId: string, active: boolean, actingUserId: string): Promise<UserResult> {
  if (userId === actingUserId) return { ok: false, error: "مينفعش توقف حسابك بنفسك" };
  const [user] = await sql()<{ role: Role }[]>`select role from users where id = ${userId}`;
  if (!user) return { ok: false, error: "المستخدم مش موجود" };
  if (!active && user.role === "owner" && (await otherActiveOwners(userId)) === 0) return { ok: false, error: "لازم يفضل مالك واحد نشط على الأقل" };
  await sql().begin(async (tx) => {
    await tx`update users set active = ${active} where id = ${userId}`;
    if (!active) await tx`delete from sessions where user_id = ${userId}`;
  });
  return { ok: true };
}

export async function setRole(userId: string, role: Role, actingUserId: string): Promise<UserResult> {
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: "دور غير صالح" };
  if (userId === actingUserId) return { ok: false, error: "مينفعش تغيّر دور حسابك بنفسك" };
  const [user] = await sql()<{ role: Role }[]>`select role from users where id = ${userId}`;
  if (!user) return { ok: false, error: "المستخدم مش موجود" };
  if (user.role === "owner" && role !== "owner" && (await otherActiveOwners(userId)) === 0) return { ok: false, error: "لازم يفضل مالك واحد نشط على الأقل" };
  await sql()`update users set role = ${role} where id = ${userId}`;
  return { ok: true };
}

/** New temporary password; the user must change it at the next sign-in, and every session of theirs is closed. */
export async function resetPassword(userId: string): Promise<UserResult> {
  const password = temporaryPassword();
  const hash = await hashPassword(password);
  const done = await sql().begin(async (tx) => {
    const rows = await tx`update users set password_hash = ${hash}, must_change_password = true where id = ${userId} returning id`;
    if (rows.length === 0) return false;
    await tx`delete from sessions where user_id = ${userId}`;
    return true;
  });
  return done ? { ok: true, temporaryPassword: password } : { ok: false, error: "المستخدم مش موجود" };
}
