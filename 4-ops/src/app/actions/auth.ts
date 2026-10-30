"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formText } from "@/lib/action-state";
import { changePassword, signIn, signOut } from "@/server/auth-core";
import { clientFingerprint } from "@/server/request";
import { clearSessionCookie, currentToken, requireUser, setSessionCookie } from "@/server/session";

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) return { error: "اكتب الإيميل والباسورد" };

  let result;
  try {
    result = await signIn(email, password, await clientFingerprint());
  } catch (error) {
    console.error("[login]", error instanceof Error ? error.message : error);
    return { error: "تعذّر الاتصال بقاعدة البيانات. تأكد إنها شغّالة وإن DATABASE_URL صح." };
  }
  if (!result.ok) {
    if (result.reason === "limited") {
      const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60));
      return { error: `محاولات دخول كتير. جرّب تاني بعد ${minutes} دقيقة.` };
    }
    // One message for "no such email", "wrong password" and "suspended account": the form must not reveal which exist.
    return { error: "الإيميل أو الباسورد غلط" };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(result.mustChangePassword ? "/account/password" : "/");
}

export async function logoutAction(): Promise<void> {
  const token = await currentToken();
  if (token) {
    try {
      await signOut(token);
    } catch (error) {
      console.error("[logout]", error instanceof Error ? error.message : error);
    }
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser({ allowMustChange: true });
  const next = formText(formData, "next");
  if (next !== formText(formData, "repeat")) return { fieldErrors: { repeat: "الباسورد الجديد مش متطابق" } };
  const result = await changePassword(user.id, formText(formData, "current"), next, (await currentToken()) ?? null);
  if (!result.ok) return { error: result.error };
  redirect("/");
}
