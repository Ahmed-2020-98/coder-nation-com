"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formText } from "@/lib/action-state";
import { ROLES, type Role } from "@/lib/crm-rules";
import { companySchema, saveCompany } from "@/server/company";
import { requirePermission } from "@/server/session";
import { createUser, resetPassword, setActive, setRole } from "@/server/users";

const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function saveCompanyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("company.edit");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  await saveCompany(parsed.data);
  refresh();
  return { ok: true, message: "اتحفظت بيانات الشركة" };
}

export async function createUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("users.manage");
  const role = formText(formData, "role");
  if (!(ROLES as readonly string[]).includes(role)) return { error: "دور غير صالح" };
  const result = await createUser({ email: formText(formData, "email"), name: formText(formData, "name"), role: role as Role });
  if (!result.ok) return { error: result.error };
  refresh();
  // Shown once, on this screen only: nothing stores it in clear text.
  return { ok: true, message: `اتعمل المستخدم. الباسورد المؤقت (بيظهر مرة واحدة): ${result.temporaryPassword}` };
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const user = await requirePermission("users.manage");
  const id = formText(formData, "id");
  if (!isId(id)) redirect("/settings/users");
  await setActive(id, formText(formData, "active") === "1", user.id);
  refresh();
}

export async function setRoleAction(formData: FormData): Promise<void> {
  const user = await requirePermission("users.manage");
  const id = formText(formData, "id");
  const role = formText(formData, "role");
  if (!isId(id) || !(ROLES as readonly string[]).includes(role)) redirect("/settings/users");
  await setRole(id, role as Role, user.id);
  refresh();
}

export async function resetPasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("users.manage");
  const id = formText(formData, "id");
  if (!isId(id)) return { error: "مستخدم غير صالح" };
  const result = await resetPassword(id);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: `الباسورد المؤقت الجديد (بيظهر مرة واحدة): ${result.temporaryPassword}` };
}
