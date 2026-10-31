import "server-only";
import { randomUUID } from "node:crypto";
import { planFromPhases } from "@/lib/project-plan";
import { todayInCairo } from "@/lib/dates";
import type { ProjectStatus } from "@/lib/task-rules";
import { sql } from "./db";
import { fromJson } from "./sql";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  clientId: string | null;
  clientName: string | null;
  dealId: string | null;
  proposalId: string | null;
  managerId: string | null;
  managerName: string | null;
  startDate: string;
  dueDate: string | null;
  notes: string;
  createdAt: Date;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
};

type Row = {
  id: string;
  name: string;
  status: ProjectStatus;
  client_id: string | null;
  client_name: string | null;
  deal_id: string | null;
  proposal_id: string | null;
  manager_id: string | null;
  manager_name: string | null;
  start_date: string;
  due_date: string | null;
  notes: string;
  created_at: Date;
  total_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
};

const toProject = (r: Row): Project => ({
  id: r.id,
  name: r.name,
  status: r.status,
  clientId: r.client_id,
  clientName: r.client_name,
  dealId: r.deal_id,
  proposalId: r.proposal_id,
  managerId: r.manager_id,
  managerName: r.manager_name,
  startDate: r.start_date,
  dueDate: r.due_date,
  notes: r.notes,
  createdAt: r.created_at,
  totalTasks: r.total_tasks,
  doneTasks: r.done_tasks,
  overdueTasks: r.overdue_tasks,
});

/** `memberId` narrows the task counts to that person's tasks: an employee never sees how many tasks colleagues hold. */
function projectSelect(memberId?: string) {
  const db = sql();
  const mine = memberId ? db`and t.assignee_id = ${memberId}` : db``;
  return db`
    select p.id, p.name, p.status, p.client_id, c.name as client_name, p.deal_id, p.proposal_id, p.manager_id, u.name as manager_name,
           date_format(p.start_date, '%Y-%m-%d') as start_date, date_format(p.due_date, '%Y-%m-%d') as due_date, p.notes, p.created_at,
           (select count(*) from tasks t where t.project_id = p.id ${mine}) as total_tasks,
           (select count(*) from tasks t where t.project_id = p.id and t.status = 'done' ${mine}) as done_tasks,
           (select count(*) from tasks t where t.project_id = p.id and t.status <> 'done' and t.due_date < ${todayInCairo()} ${mine}) as overdue_tasks
    from projects p left join clients c on c.id = p.client_id left join users u on u.id = p.manager_id`;
}

/** `memberId` limits the list to projects that have a task assigned to that person (what an employee sees). */
export async function listProjects(filter: { memberId?: string } = {}): Promise<Project[]> {
  const db = sql();
  const rows = await db<Row[]>`
    select * from (${projectSelect(filter.memberId)}) as p
    where true ${filter.memberId ? db`and exists (select 1 from tasks t where t.project_id = p.id and t.assignee_id = ${filter.memberId})` : db``}
    order by (p.status in ('done', 'cancelled')), (p.due_date is null), p.due_date, p.created_at desc limit 300`;
  return rows.map(toProject);
}

export async function getProject(id: string, memberId?: string): Promise<Project | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const [row] = await db<Row[]>`select * from (${projectSelect(memberId)}) as p where p.id = ${id}`;
  return row ? toProject(row) : null;
}

export async function userHasTaskIn(projectId: string, userId: string): Promise<boolean> {
  const rows = await sql()`select 1 from tasks where project_id = ${projectId} and assignee_id = ${userId} limit 1`;
  return rows.length > 0;
}

export async function projectOfDeal(dealId: string): Promise<{ id: string; name: string }[]> {
  return sql()<{ id: string; name: string }[]>`select id, name from projects where deal_id = ${dealId} order by created_at`;
}

export type ProjectInput = { name: string; clientId: string | null; managerId: string | null; startDate: string; dueDate: string | null; notes: string };

export async function createProject(input: ProjectInput, createdBy: string): Promise<string> {
  const id = randomUUID();
  await sql()`
    insert into projects (id, name, client_id, manager_id, start_date, due_date, notes, created_by)
    values (${id}, ${input.name}, ${input.clientId}, ${input.managerId}, ${input.startDate}, ${input.dueDate}, ${input.notes}, ${createdBy})`;
  return id;
}

export type StartResult = { ok: true; id: string; tasks: number } | { ok: false; error: string };

/**
 * "ابدأ المشروع" on a won deal: a project for its client and, from the proposal's timeline, one task per phase with a due
 * date counted from `startDate`. Which proposal: the accepted one, else the latest sent one, else none (an empty project).
 */
export async function startProjectFromDeal(dealId: string, startDate: string, byUserId: string): Promise<StartResult> {
  return sql().begin(async (tx): Promise<StartResult> => {
    const [deal] = await tx<{ title: string; stage: string; client_id: string; owner_id: string | null }[]>`
      select title, stage, client_id, owner_id from deals where id = ${dealId} for update`;
    if (!deal) return { ok: false, error: "الصفقة مش موجودة" };
    if (deal.stage !== "won") return { ok: false, error: "المشروع بيبدأ من صفقة «فاز» بس" };
    const [proposal] = await tx<{ id: string; title: string; timeline: { title: string; weeks: number }[] }[]>`
      select id, title, timeline from proposals
      where deal_id = ${dealId} and status in ('accepted', 'sent')
      order by (status = 'accepted') desc, sent_at desc, created_at desc limit 1`;
    if (proposal) {
      const [taken] = await tx<{ id: string }[]>`select id from projects where proposal_id = ${proposal.id}`;
      if (taken) return { ok: false, error: "فيه مشروع اتبدأ من العرض ده قبل كده" };
    }
    const phases = proposal ? fromJson<{ title: string; weeks: number }[]>(proposal.timeline) : [];
    const plan = planFromPhases(startDate, phases);
    const dueDate = plan.length > 0 ? plan[plan.length - 1].dueDate : null;
    const projectId = randomUUID();
    await tx`
      insert into projects (id, client_id, deal_id, proposal_id, name, manager_id, start_date, due_date, created_by)
      values (${projectId}, ${deal.client_id}, ${dealId}, ${proposal?.id ?? null}, ${deal.title}, ${deal.owner_id ?? byUserId}, ${startDate}, ${dueDate}, ${byUserId})`;
    for (const task of plan) {
      const taskId = randomUUID();
      await tx`insert into tasks (id, project_id, title, due_date, deal_id, created_by) values (${taskId}, ${projectId}, ${task.title}, ${task.dueDate}, ${dealId}, ${byUserId})`;
      await tx`insert into task_events (id, task_id, user_id, kind, body) values (${randomUUID()}, ${taskId}, ${byUserId}, 'system', 'اتعملت من مراحل العرض')`;
    }
    await tx`insert into activities (id, deal_id, user_id, kind, body) values (${randomUUID()}, ${dealId}, ${byUserId}, 'system', ${`اتبدأ المشروع (${plan.length} مهمة)`})`;
    return { ok: true, id: projectId, tasks: plan.length };
  });
}

export async function updateProject(id: string, input: ProjectInput & { status: ProjectStatus }): Promise<boolean> {
  const closing = input.status === "done" || input.status === "cancelled";
  const result = await sql()`
    update projects set name = ${input.name}, client_id = ${input.clientId}, manager_id = ${input.managerId}, start_date = ${input.startDate},
           due_date = ${input.dueDate}, notes = ${input.notes}, status = ${input.status},
           closed_at = ${closing ? sql()`coalesce(closed_at, now(3))` : null}
    where id = ${id}`;
  return result.count > 0;
}
