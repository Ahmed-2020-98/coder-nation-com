"use server";

import { redirect } from "next/navigation";
import { refresh } from "@/server/refresh";
import { z } from "zod";
import { formText, type ActionState } from "@/lib/action-state";
import { isIsoDate } from "@/lib/dates";
import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/task-rules";
import { sql } from "@/server/db";
import { canAccessTask } from "@/server/permissions";
import { addComment, assignTask, changeStatus, createTask, getTask, updateTaskDetails, type NewTask } from "@/server/tasks";
import { requirePermission } from "@/server/session";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const optionalUuid = z.union([uuid, z.literal("")]).transform((v) => (v === "" ? null : v));

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان المهمة").max(200),
  description: z.string().trim().max(4000),
  priority: z.enum(PRIORITIES, "اختار الأولوية"),
  dueDate: z
    .string()
    .trim()
    .refine((v) => v === "" || isIsoDate(v), "تاريخ غير صحيح")
    .transform((v) => (v === "" ? null : v)),
  assigneeId: optionalUuid,
  projectId: optionalUuid,
  dealId: optionalUuid,
  clientId: optionalUuid,
});

/** Every id the form names must exist (and the assignee must be an active person); a friendly error beats a foreign-key crash. */
async function checkReferences(ref: { assigneeId?: string | null; projectId: string | null; dealId: string | null; clientId: string | null }): Promise<string | null> {
  const db = sql();
  if (ref.assigneeId) {
    const [row] = await db`select 1 from users where id = ${ref.assigneeId} and active`;
    if (!row) return "المستخدم ده مش موجود أو موقوف";
  }
  if (ref.projectId && (await db`select 1 from projects where id = ${ref.projectId}`).length === 0) return "المشروع مش موجود";
  if (ref.dealId && (await db`select 1 from deals where id = ${ref.dealId}`).length === 0) return "الصفقة مش موجودة";
  if (ref.clientId && (await db`select 1 from clients where id = ${ref.clientId}`).length === 0) return "العميل مش موجود";
  return null;
}

export async function createTaskAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("task.create");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const refError = await checkReferences(parsed.data);
  if (refError) return { error: refError };
  const input: NewTask = { ...parsed.data, priority: parsed.data.priority as Priority };
  const id = await createTask(input, user.id);
  redirect(`/tasks/${id}`);
}

export async function updateTaskAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("task.edit");
  const id = formText(formData, "id");
  if (!uuid.safeParse(id).success) return { error: "طلب غير صالح" };
  const parsed = taskSchema.omit({ assigneeId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const refError = await checkReferences(parsed.data);
  if (refError) return { error: refError };
  if (!(await updateTaskDetails(id, { ...parsed.data, priority: parsed.data.priority as Priority }))) return { error: "المهمة مش موجودة" };
  refresh();
  return { ok: true };
}

export async function assignTaskAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("task.assign");
  const id = formText(formData, "id");
  const assigneeId = formText(formData, "assigneeId");
  if (!uuid.safeParse(id).success || (assigneeId !== "" && !uuid.safeParse(assigneeId).success)) return { error: "طلب غير صالح" };
  const refError = await checkReferences({ assigneeId: assigneeId || null, projectId: null, dealId: null, clientId: null });
  if (refError) return { error: refError };
  if (!(await assignTask(id, assigneeId || null, user.id))) return { error: "المهمة مش موجودة" };
  refresh();
  return { ok: true };
}

/** Status changes: `task.progress` for everyone, then the transition rules decide what each role may do (task-flow.ts). */
export async function changeTaskStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("task.progress");
  const id = formText(formData, "id");
  const to = formText(formData, "status");
  if (!uuid.safeParse(id).success || !(TASK_STATUSES as readonly string[]).includes(to)) return { error: "طلب غير صالح" };
  const task = await getTask(id);
  // An employee asking about someone else's task gets the same answer as for a task that doesn't exist.
  if (!task || !canAccessTask(user, task)) return { error: "المهمة مش موجودة" };
  const result = await changeStatus(id, to as TaskStatus, formText(formData, "reason") || null, user);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

export async function addCommentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("task.comment");
  const id = formText(formData, "id");
  if (!uuid.safeParse(id).success) return { error: "طلب غير صالح" };
  const task = await getTask(id);
  if (!task || !canAccessTask(user, task)) return { error: "المهمة مش موجودة" };
  const body = formText(formData, "body").trim();
  if (body.length < 1 || body.length > 4000) return { fieldErrors: { body: "اكتب التعليق (حتى 4000 حرف)" } };
  await addComment(id, user.id, body);
  refresh();
  return { ok: true };
}
