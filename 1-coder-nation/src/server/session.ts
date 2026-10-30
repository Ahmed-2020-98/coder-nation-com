import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminFromToken, type Admin } from "./auth-core";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { isProduction } from "./env";

export { SESSION_COOKIE };

/** The signed-in admin for this request, or null. A database failure counts as "not signed in", never as an error page. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await adminFromToken(token);
  } catch {
    return null;
  }
});

/**
 * The gate. Call it first in EVERY admin page, server action and route handler: layouts don't re-run on client
 * navigations and actions are public endpoints, so a check in one place only is not a check.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    path: "/admin",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: isProduction, path: "/admin", maxAge: 0 });
}

export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
