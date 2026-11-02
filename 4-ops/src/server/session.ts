import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/crm-rules";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { currentActor } from "./actor";
import { userFromToken, type SessionUser } from "./auth-core";
import { isProduction } from "./env";
import { can, type Permission } from "./permissions";

export { SESSION_COOKIE };

/** The signed-in user for this request, or null. A database failure counts as "not signed in", never as an error page. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  // An MCP call acting as an API key's owner (src/server/actor.ts) has no cookie: it is that person.
  const actor = currentActor();
  if (actor) return actor;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await userFromToken(token);
  } catch {
    return null;
  }
});

/**
 * The gate. Call it first in EVERY page, server action and route handler: layouts don't re-run on client
 * navigations and actions are public endpoints, so a check in one place only is not a check.
 * A user who must change their password is sent there before anything else.
 */
export async function requireUser(options: { allowMustChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowMustChange) redirect("/account/password");
  return user;
}

/** requireUser() plus the permission table. A signed-in user without the permission is sent home, not shown an error. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role as Role, permission)) redirect("/");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isProduction, path: "/", expires: expiresAt });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: isProduction, path: "/", maxAge: 0 });
}

export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
