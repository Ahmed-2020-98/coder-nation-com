"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { formText, type ActionState } from "@/lib/action-state";
import { isIsoDate, todayInCairo } from "@/lib/dates";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/task-rules";
import { sql } from "@/server/db";
import { createProject, startProjectFromDeal, updateProject } from "@/server/projects";
import { requirePermission } from "@/server/session";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const optionalUuid = z.union([uuid, z.literal("")]).transform((v) => (v === "" ? null : v));
const isoDate = (message: string) => z.string().trim().refine(isIsoDate, message);

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

const projectSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب اسم المشروع").max(200),
    clientId: optionalUuid,
    managerId: optionalUuid,
    startDate: isoDate("اختار تاريخ البدء"),
    dueDate: z
      .string()
      .trim()
      .refine((v) => v === "" || isIsoDate(v), "تاريخ غير صحيح")
      .transform((v) => (v === "" ? null : v)),
    notes: z.string().trim().max(4000),
  })
  .refine((v) => v.dueDate === null || v.dueDate >= v.startDate, { path: ["dueDate"], message: "التسليم قبل البدء" });

async function checkReferences(clientId: string | null, managerId: string | null): Promise<string | null> {
  const db = sql();
  if (clientId && (await db`select 1 from clients where id = ${clientId}`).length === 0) return "العميل مش موجود";
  if (managerId && (await db`select 1 from users where id = ${managerId} and active`).length === 0) return "مدير المشروع مش موجود أو موقوف";
  return null;
}

export async function createProjectAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("project.manage");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const refError = await checkReferences(parsed.data.clientId, parsed.data.managerId);
  if (refError) return { error: refError };
  const id = await createProject(parsed.data, user.id);
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("project.manage");
  const id = formText(formData, "id");
  const status = formText(formData, "status");
  if (!uuid.safeParse(id).success || !(PROJECT_STATUSES as readonly string[]).includes(status)) return { error: "طلب غير صالح" };
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const refError = await checkReferences(parsed.data.clientId, parsed.data.managerId);
  if (refError) return { error: refError };
  if (!(await updateProject(id, { ...parsed.data, status: status as ProjectStatus }))) return { error: "المشروع مش موجود" };
  refresh();
  return { ok: true };
}

/** "ابدأ المشروع" on a won deal. Starting work is the managers' call, so it needs `project.manage` and sees every deal. */
export async function startProjectAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("project.manage");
  const dealId = formText(formData, "dealId");
  const startDate = formText(formData, "startDate").trim() || todayInCairo();
  if (!uuid.safeParse(dealId).success) return { error: "طلب غير صالح" };
  if (!isIsoDate(startDate)) return { fieldErrors: { startDate: "اختار تاريخ البدء" } };
  const result = await startProjectFromDeal(dealId, startDate, user.id);
  if (!result.ok) return { error: result.error };
  redirect(`/projects/${result.id}`);
}
