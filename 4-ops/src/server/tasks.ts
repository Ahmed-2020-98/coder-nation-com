import "server-only";
import type { Role } from "@/lib/crm-rules";
import { todayInCairo } from "@/lib/dates";
import { validateTaskTransition, type TaskTransition } from "@/lib/task-flow";
import { TASK_STATUS_LABEL, type Priority, type TaskEventKind, type TaskStatus } from "@/lib/task-rules";
import { sql } from "./db";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  blockedReason: string | null;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  blocked_reason: string | null;
  priority: Priority;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  deal_id: string | null;
  deal_title: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: Date;
  completed_at: Date | null;
};

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  blockedReason: r.blocked_reason,
  priority: r.priority,
  assigneeId: r.assignee_id,
  assigneeName: r.assignee_name,
  dueDate: r.due_date,
  projectId: r.project_id,
  projectName: r.project_name,
  dealId: r.deal_id,
  dealTitle: r.deal_title,
  clientId: r.client_id,
  clientName: r.client_name,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

/** A task with its assignee, project, deal and client names. Due dates come back as plain "YYYY-MM-DD" text. */
function taskSelect() {
  return sql()`
    select t.id, t.title, t.description, t.status, t.blocked_reason, t.priority, t.assignee_id, u.name as assignee_name,
           to_char(t.due_date, 'YYYY-MM-DD') as due_date, t.project_id, p.name as project_name, t.deal_id, d.title as deal_title,
           t.client_id, c.name as client_name, t.created_at, t.completed_at
    from tasks t
    left join users u on u.id = t.assignee_id
    left join projects p on p.id = t.project_id
    left join deals d on d.id = t.deal_id
    left join clients c on c.id = coalesce(t.client_id, p.client_id)`;
}

export type TaskFilter = {
  assigneeId?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  overdueOnly?: boolean;
  q?: string;
  /** Finished tasks older than this many days are left out of boards (they would pile up forever). */
  doneWithinDays?: number;
};

export async function listTasks(filter: TaskFilter = {}): Promise<Task[]> {
  const db = sql();
  const q = filter.q?.trim().slice(0, 100).toLowerCase();
  const today = todayInCairo();
  const rows = await db<TaskRow[]>`
    select * from (${taskSelect()}) as t
    where true
      ${filter.assigneeId ? db`and t.assignee_id = ${filter.assigneeId}` : db``}
      ${filter.projectId ? db`and t.project_id = ${filter.projectId}` : db``}
      ${filter.status ? db`and t.status = ${filter.status}` : db``}
      ${filter.priority ? db`and t.priority = ${filter.priority}` : db``}
      ${filter.overdueOnly ? db`and t.due_date < ${today} and t.status <> 'done'` : db``}
      ${q ? db`and (strpos(lower(t.title), ${q}) > 0 or strpos(lower(coalesce(t.project_name, '')), ${q}) > 0 or strpos(lower(coalesce(t.client_name, '')), ${q}) > 0)` : db``}
      ${filter.doneWithinDays ? db`and (t.status <> 'done' or t.completed_at > now() - make_interval(days => ${filter.doneWithinDays}))` : db``}
    order by (t.status = 'done'), t.due_date nulls last,
             case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.created_at desc
    limit 500`;
  return rows.map(toTask);
}

export async function getTask(id: string): Promise<Task | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [row] = await db<TaskRow[]>`select * from (${taskSelect()}) as t where t.id = ${id}`;
  return row ? toTask(row) : null;
}

export type NewTask = {
  title: string;
  description: string;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  projectId: string | null;
  dealId: string | null;
  clientId: string | null;
};

export async function createTask(input: NewTask, createdBy: string): Promise<string> {
  return sql().begin(async (tx) => {
    const [task] = await tx<{ id: string }[]>`
      insert into tasks (title, description, priority, assignee_id, due_date, project_id, deal_id, client_id, created_by)
      values (${input.title}, ${input.description}, ${input.priority}, ${input.assigneeId}, ${input.dueDate}, ${input.projectId}, ${input.dealId}, ${input.clientId}, ${createdBy})
      returning id`;
    await tx`insert into task_events (task_id, user_id, kind, body) values (${task.id}, ${createdBy}, 'system', 'اتعملت المهمة')`;
    return task.id;
  });
}

export async function updateTaskDetails(id: string, patch: Omit<NewTask, "assigneeId">): Promise<boolean> {
  const rows = await sql()`
    update tasks set title = ${patch.title}, description = ${patch.description}, priority = ${patch.priority}, due_date = ${patch.dueDate},
           project_id = ${patch.projectId}, deal_id = ${patch.dealId}, client_id = ${patch.clientId}, updated_at = now()
    where id = ${id} returning id`;
  return rows.length > 0;
}

export async function assignTask(id: string, assigneeId: string | null, byUserId: string): Promise<boolean> {
  return sql().begin(async (tx) => {
    const rows = await tx`update tasks set assignee_id = ${assigneeId}, updated_at = now() where id = ${id} returning id`;
    if (rows.length === 0) return false;
    const [who] = assigneeId ? await tx<{ name: string }[]>`select name from users where id = ${assigneeId}` : [];
    await tx`insert into task_events (task_id, user_id, kind, body) values (${id}, ${byUserId}, 'assign', ${who ? `اتسندت لـ ${who.name}` : "اتشال المسؤول عن المهمة"})`;
    return true;
  });
}

/** Changes the status under the transition rules for `role`, inside one transaction with the task row locked. */
export async function changeStatus(id: string, to: TaskStatus, reason: string | null, user: { id: string; role: Role }): Promise<TaskTransition> {
  return sql().begin(async (tx): Promise<TaskTransition> => {
    const [task] = await tx<{ status: TaskStatus }[]>`select status from tasks where id = ${id} for update`;
    if (!task) return { ok: false, error: "المهمة مش موجودة" };
    const check = validateTaskTransition(user.role, task.status, to, reason);
    if (!check.ok) return check;
    const blockedReason = to === "blocked" ? reason!.trim() : null;
    await tx`
      update tasks set status = ${to}, blocked_reason = ${blockedReason}, updated_at = now(),
             completed_at = ${to === "done" ? tx`now()` : null}
      where id = ${id}`;
    await tx`insert into task_events (task_id, user_id, kind, body)
             values (${id}, ${user.id}, 'status', ${`من «${TASK_STATUS_LABEL[task.status]}» إلى «${TASK_STATUS_LABEL[to]}»${blockedReason ? `. السبب: ${blockedReason}` : ""}`})`;
    return { ok: true };
  });
}

export type TaskEvent = { id: string; kind: TaskEventKind; body: string; userName: string | null; createdAt: Date };

export async function listEvents(taskId: string): Promise<TaskEvent[]> {
  const rows = await sql()<{ id: string; kind: TaskEventKind; body: string; name: string | null; created_at: Date }[]>`
    select e.id, e.kind, e.body, u.name, e.created_at from task_events e left join users u on u.id = e.user_id
    where e.task_id = ${taskId} order by e.created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body, userName: r.name, createdAt: r.created_at }));
}

export async function addComment(taskId: string, userId: string, body: string): Promise<void> {
  await sql()`insert into task_events (task_id, user_id, kind, body) values (${taskId}, ${userId}, 'comment', ${body})`;
  await sql()`update tasks set updated_at = now() where id = ${taskId}`;
}

export async function taskCounts(assigneeId?: string): Promise<{ open: number; overdue: number }> {
  const db = sql();
  const [row] = await db<{ open: number; overdue: number }[]>`
    select count(*) filter (where status <> 'done')::int as open,
           count(*) filter (where status <> 'done' and due_date < ${todayInCairo()})::int as overdue
    from tasks ${assigneeId ? db`where assignee_id = ${assigneeId}` : db``}`;
  return row;
}
