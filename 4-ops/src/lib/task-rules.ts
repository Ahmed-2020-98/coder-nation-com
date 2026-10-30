// Vocabulary of tasks and projects, safe to import from browser code.

export const TASK_STATUSES = ["todo", "doing", "review", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: "للعمل", doing: "جاري", review: "مراجعة", done: "تم", blocked: "متعطّلة" };
/** The board's columns, in order. "blocked" sits beside "doing" because it is work in progress that is stuck. */
export const BOARD_COLUMNS = ["todo", "doing", "blocked", "review", "done"] as const satisfies readonly TaskStatus[];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };

export const PROJECT_STATUSES = ["active", "on_hold", "done", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { active: "شغّال", on_hold: "متوقف", done: "منتهي", cancelled: "ملغي" };

export type TaskEventKind = "comment" | "status" | "assign" | "system";
export const TASK_EVENT_LABEL: Record<TaskEventKind, string> = { comment: "تعليق", status: "تغيير حالة", assign: "إسناد", system: "النظام" };
