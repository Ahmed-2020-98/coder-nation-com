import type { Role } from "@/lib/crm-rules";

/**
 * Who may do what, in one table. Pages, server actions and route handlers all ask `can()`; nothing else decides.
 * `employee` is additionally limited to deals assigned to them (see canAccessDeal).
 */
export const PERMISSIONS = {
  "deal.view_all": ["owner", "manager"],
  "deal.view_own": ["owner", "manager", "employee"],
  "deal.create": ["owner", "manager"],
  "deal.edit": ["owner", "manager"],
  "deal.move": ["owner", "manager"],
  "deal.assign": ["owner", "manager"],
  "deal.log_activity": ["owner", "manager", "employee"],
  "client.manage": ["owner", "manager"],
  "proposal.view": ["owner", "manager"],
  "proposal.edit": ["owner", "manager"],
  "proposal.export": ["owner", "manager"],
  "company.edit": ["owner", "manager"],
  "users.manage": ["owner"],
  "task.view_own": ["owner", "manager", "employee"],
  "task.view_all": ["owner", "manager"],
  "task.create": ["owner", "manager"],
  "task.edit": ["owner", "manager"],
  "task.assign": ["owner", "manager"],
  "task.close": ["owner", "manager"],
  "task.progress": ["owner", "manager", "employee"],
  "task.comment": ["owner", "manager", "employee"],
  "project.view_own": ["owner", "manager", "employee"],
  "project.view_all": ["owner", "manager"],
  "project.manage": ["owner", "manager"],
  // Everyone tracked records their own day; only owners and managers see the team, fix records, set shifts and enter leaves.
  "attendance.record": ["owner", "manager", "employee"],
  "attendance.view_all": ["owner", "manager"],
  "attendance.edit": ["owner", "manager"],
  "schedule.manage": ["owner", "manager"],
  "leave.manage": ["owner", "manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Owners and managers see every deal; an employee sees only the ones assigned to them. */
export function canAccessDeal(user: { id: string; role: Role }, deal: { ownerId: string | null }): boolean {
  return can(user.role, "deal.view_all") || (can(user.role, "deal.view_own") && deal.ownerId === user.id);
}

/** An employee reaches a task only if it is assigned to them; owners and managers reach all of them. */
export function canAccessTask(user: { id: string; role: Role }, task: { assigneeId: string | null }): boolean {
  return can(user.role, "task.view_all") || (can(user.role, "task.view_own") && task.assigneeId === user.id);
}
