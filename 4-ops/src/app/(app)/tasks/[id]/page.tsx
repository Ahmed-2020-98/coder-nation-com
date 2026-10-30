import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, TaskStatusBadge } from "@/components/task-badges";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { isOverdue, todayInCairo } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { validateTaskTransition } from "@/lib/task-flow";
import { TASK_EVENT_LABEL, TASK_STATUSES } from "@/lib/task-rules";
import { can, canAccessTask } from "@/server/permissions";
import { listProjects } from "@/server/projects";
import { requireUser } from "@/server/session";
import { getTask, listEvents } from "@/server/tasks";
import { listAssignableUsers } from "@/server/users";
import { CommentForm, TaskAssignForm, TaskEditForm, TaskStatusForm } from "../TaskForms";

export const metadata: Metadata = { title: "تفاصيل المهمة" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTask(id);
  // An employee asking for a colleague's task gets the same "not found" as for a task that doesn't exist.
  if (!task || !canAccessTask(user, task)) notFound();

  const edit = can(user.role, "task.edit");
  const [events, users, projects] = await Promise.all([
    listEvents(id),
    can(user.role, "task.assign") ? listAssignableUsers() : Promise.resolve([]),
    edit ? listProjects() : Promise.resolve([]),
  ]);
  // Only the moves this role may make are offered; the action re-checks them on submit.
  const allowed = can(user.role, "task.progress") ? TASK_STATUSES.filter((to) => validateTaskTransition(user.role, task.status, to, "سبب").ok) : [];
  const overdue = isOverdue(task.dueDate, task.status, todayInCairo());
  const seesDeals = can(user.role, "task.view_all");

  return (
    <>
      <Link href="/tasks" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        كل المهام
      </Link>
      <PageHeader
        title={task.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {overdue ? <Badge tone="error">متأخرة</Badge> : null}
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">التفاصيل</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">المسؤول</dt>
                <dd className="mt-0.5 text-base font-semibold">{task.assigneeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">موعد التسليم</dt>
                <dd className={overdue ? "mt-0.5 text-base font-semibold text-error-700" : "mt-0.5 text-base font-semibold"}>{task.dueDate ? formatDate(task.dueDate) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">المشروع</dt>
                <dd className="mt-0.5 text-base font-semibold">
                  {task.projectId ? (
                    <Link href={`/projects/${task.projectId}`} className="underline-offset-4 hover:text-accent hover:underline">
                      {task.projectName}
                    </Link>
                  ) : (
                    "مهمة مستقلة"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">العميل</dt>
                <dd className="mt-0.5 text-base font-semibold">{task.clientName ?? "—"}</dd>
              </div>
              {seesDeals && task.dealId ? (
                <div>
                  <dt className="text-ink-muted">الصفقة</dt>
                  <dd className="mt-0.5 text-base font-semibold">
                    <Link href={`/crm/deals/${task.dealId}`} className="underline-offset-4 hover:text-accent hover:underline">
                      {task.dealTitle}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {task.blockedReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">سبب التعطيل</dt>
                  <dd className="mt-0.5 text-base font-semibold text-error-700">{task.blockedReason}</dd>
                </div>
              ) : null}
              {task.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">الوصف</dt>
                  <dd className="mt-0.5 leading-8 whitespace-pre-wrap">{task.description}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">التعليقات والسجل</h2>
            {can(user.role, "task.comment") ? <CommentForm id={id} /> : null}
            <ol className="mt-6 grid gap-4 border-t border-line pt-5">
              {events.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-ink-muted">
                    <Badge tone={event.kind === "comment" ? "accent" : "neutral"}>{TASK_EVENT_LABEL[event.kind]}</Badge>
                    {event.userName ?? "النظام"} · {formatDateTime(event.createdAt)}
                  </p>
                  <p className="mt-1.5 leading-7 whitespace-pre-wrap">{event.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">الحالة</h2>
            <TaskStatusForm key={task.status} id={id} status={task.status} allowed={allowed} />
            {can(user.role, "task.assign") ? (
              <div className="mt-5 border-t border-line pt-5">
                <TaskAssignForm id={id} assigneeId={task.assigneeId} users={users} />
              </div>
            ) : null}
          </Card>

          {edit ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">تعديل المهمة</h2>
              <TaskEditForm
                id={id}
                values={{
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  dueDate: task.dueDate ?? "",
                  projectId: task.projectId ?? "",
                  dealId: task.dealId ?? "",
                  clientId: task.clientId ?? "",
                }}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
