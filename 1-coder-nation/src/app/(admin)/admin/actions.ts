"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth-core";
import { deleteLead, isLeadStatus, updateLead } from "@/server/leads";
import { LEAD_LIMITS } from "@/lib/lead-rules";
import { clientFingerprint } from "@/server/request";
import { clearSessionCookie, currentToken, requireAdmin, setSessionCookie } from "@/server/session";
import { SETTINGS_TAG, SOCIAL_KEYS, settingsSchema, writeSettings } from "@/server/settings";

/** What every form in the panel gets back. `fieldErrors` keys are the form's field names. */
export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

const text = (formData: FormData, key: string) => (typeof formData.get(key) === "string" ? (formData.get(key) as string) : "");

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const password = text(formData, "password");
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
    // One message for "no such email" and "wrong password": the form must not reveal which emails are admins.
    return { error: "الإيميل أو الباسورد غلط" };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect("/admin");
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
  redirect("/admin/login");
}

export async function updateLeadAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
  const note = text(formData, "note").trim();
  if (!isLeadStatus(status)) return { error: "حالة غير صالحة" };
  if (note.length > LEAD_LIMITS.message) return { fieldErrors: { note: `الملاحظة أطول من ${LEAD_LIMITS.message} حرف` } };
  const found = await updateLead(id, { status, note });
  if (!found) return { error: "الطلب ده اتمسح أو مش موجود" };
  // Re-render this page and the sidebar (the "new" counter) with the saved values.
  refresh();
  return { ok: true };
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteLead(text(formData, "id"));
  redirect("/admin/leads");
}

export async function saveSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    whatsappNumber: text(formData, "whatsappNumber"),
    email: text(formData, "email"),
    workingHours: text(formData, "workingHours"),
    socials: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, text(formData, `social_${key}`)])),
    seo: { title: text(formData, "seoTitle"), description: text(formData, "seoDescription") },
    ecosystem: { marketing: formData.has("eco_marketing"), sales: formData.has("eco_sales"), crm: formData.has("eco_crm") },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [section, sub] = issue.path;
      const name =
        section === "socials" ? `social_${String(sub)}` : section === "seo" ? (sub === "title" ? "seoTitle" : "seoDescription") : String(section);
      fieldErrors[name] ??= issue.message;
    }
    return { fieldErrors, error: "في حقول محتاجة تصحيح" };
  }
  try {
    await writeSettings(parsed.data);
  } catch (error) {
    console.error("[settings]", error instanceof Error ? error.message : error);
    return { error: "تعذّر حفظ الإعدادات (قاعدة البيانات)" };
  }
  // Read-your-own-writes: the public pages refetch the settings on the next request instead of waiting out the cache.
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true };
}
