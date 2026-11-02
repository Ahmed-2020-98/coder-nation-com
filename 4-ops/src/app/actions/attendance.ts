"use server";

import { refresh } from "@/server/refresh";
import { z } from "zod";
import { formText, type ActionState } from "@/lib/action-state";
import { isTime, LEAVE_KINDS, type LeaveKind } from "@/lib/attendance-rules";
import { isIsoDate } from "@/lib/dates";
import { addLeave, checkIn, checkOut, deleteLeave, deleteRecord, removeSchedule, saveRecord, saveSchedule } from "@/server/attendance";
import { sql } from "@/server/db";
import { requirePermission } from "@/server/session";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const reasonSchema = z.string().trim().min(2, "اكتب السبب (حرفين على الأقل)").max(300, "السبب أطول من 300 حرف");

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

// ----- the person's own buttons: always about the signed-in user, never a user id from the form -----

export async function checkInAction(): Promise<ActionState> {
  const user = await requirePermission("attendance.record");
  const result = await checkIn(user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتسجّل حضورك" };
}

export async function checkOutAction(): Promise<ActionState> {
  const user = await requirePermission("attendance.record");
  const result = await checkOut(user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتسجّل انصرافك" };
}

// ----- shifts -----

const shiftSchema = z.object({
  userId: uuid,
  startTime: z.string().refine(isTime, "وقت غير صحيح"),
  endTime: z.string().refine(isTime, "وقت غير صحيح"),
  graceMinutes: z.coerce.number("اكتب رقم").int("اكتب رقم صحيح").min(0, "من 0 لـ 120").max(120, "من 0 لـ 120"),
});

export async function saveShiftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("schedule.manage");
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const days = [...new Set(formData.getAll("workDays").map(String))].map(Number);
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { fieldErrors: { workDays: "اختار يوم شغل واحد على الأقل" } };
  const { userId, ...shift } = parsed.data;
  const result = await saveSchedule(userId, { ...shift, workDays: days });
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

export async function removeShiftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("schedule.manage");
  const userId = formText(formData, "userId");
  if (!uuid.safeParse(userId).success) return { error: "طلب غير صالح" };
  if (!(await removeSchedule(userId))) return { error: "مفيش وردية للشخص ده" };
  refresh();
  return { ok: true, message: "اتوقف التتبّع. السجل القديم محفوظ" };
}

// ----- a manager fixing a day -----

const recordSchema = z.object({
  userId: uuid,
  date: z.string().refine(isIsoDate, "تاريخ غير صحيح"),
  checkIn: z.string().refine(isTime, "وقت الحضور غير صحيح"),
  checkOut: z.string().refine((v) => v === "" || isTime(v), "وقت الانصراف غير صحيح"),
  reason: reasonSchema,
});

export async function saveRecordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("attendance.edit");
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { checkIn: checkInTime, checkOut: checkOutTime, ...rest } = parsed.data;
  const result = await saveRecord({ ...rest, checkInTime, checkOutTime: checkOutTime || null }, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

export async function deleteRecordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("attendance.edit");
  const parsed = z.object({ userId: uuid, date: z.string().refine(isIsoDate), reason: reasonSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const result = await deleteRecord(parsed.data.userId, parsed.data.date, parsed.data.reason, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: "اتمسح التسجيل وفضل في السجل" };
}

// ----- leaves -----

const leaveSchema = z.object({
  kind: z.enum(LEAVE_KINDS, "اختار نوع الإجازة"),
  startDate: z.string().refine(isIsoDate, "اختار تاريخ البداية"),
  endDate: z.string().refine(isIsoDate, "اختار تاريخ النهاية"),
  note: z.string().trim().max(300, "الملاحظة أطول من 300 حرف"),
});

/** One person, or everyone who is tracked (`everyone=1`, e.g. an official holiday). Stored per person either way. */
export async function addLeaveAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leave.manage");
  const parsed = leaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  let userIds: string[];
  if (formText(formData, "everyone") === "1") {
    userIds = (await sql()<{ user_id: string }[]>`select w.user_id from work_schedules w join users u on u.id = w.user_id where u.active`).map((r) => r.user_id);
    if (userIds.length === 0) return { error: "مفيش موظفين متتبَّعين لسه" };
  } else {
    const userId = formText(formData, "userId");
    if (!uuid.safeParse(userId).success) return { fieldErrors: { userId: "اختار الموظف" } };
    userIds = [userId];
  }
  const result = await addLeave({ ...parsed.data, kind: parsed.data.kind as LeaveKind, userIds }, user.id);
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, message: result.skipped > 0 ? `اتسجّلت لـ ${result.created}، واتخطّينا ${result.skipped} (عندهم إجازة في الفترة دي)` : `اتسجّلت الإجازة (${result.created})` };
}

export async function deleteLeaveAction(formData: FormData): Promise<void> {
  await requirePermission("leave.manage");
  const id = formText(formData, "id");
  if (!uuid.safeParse(id).success) return;
  await deleteLeave(id);
  refresh();
}
