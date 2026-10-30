import type { Role } from "./crm-rules";
import type { TaskStatus } from "./task-rules";

export type TaskTransition = { ok: true } | { ok: false; error: string };

/** What an employee may do to their own task. "done" is the manager's call: it is the review. */
const EMPLOYEE_STATUSES: readonly TaskStatus[] = ["todo", "doing", "review", "blocked"];

/**
 * Status changes, in one place. A blocked task needs a reason (2-300 characters). Owners and managers can move a task
 * anywhere (including closing and reopening it); an employee can only move it among todo / doing / review / blocked.
 */
export function validateTaskTransition(role: Role, from: TaskStatus, to: TaskStatus, reason: string | null | undefined): TaskTransition {
  if (from === to) return { ok: false, error: "المهمة في الحالة دي بالفعل" };
  if (to === "blocked") {
    const text = reason?.trim() ?? "";
    if (text.length < 2) return { ok: false, error: "اكتب سبب التعطيل" };
    if (text.length > 300) return { ok: false, error: "سبب التعطيل أطول من 300 حرف" };
  }
  if (role === "employee") {
    if (to === "done") return { ok: false, error: "قفل المهمة «تم» بيتم من المدير بعد المراجعة. انقلها لـ«مراجعة»" };
    if (from === "done") return { ok: false, error: "المهمة اتقفلت. المدير هو اللي يفتحها تاني" };
    if (!EMPLOYEE_STATUSES.includes(to)) return { ok: false, error: "حالة غير مسموحة" };
  }
  return { ok: true };
}
