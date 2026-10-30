import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard } from "@/components/TaskCard";
import { ProjectStatusBadge } from "@/components/task-badges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { todayInCairo } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { BOARD_COLUMNS, TASK_STATUS_LABEL } from "@/lib/task-rules";
import { listClients } from "@/server/crm";
import { can } from "@/server/permissions";
import { getProject, userHasTaskIn } from "@/server/projects";
import { requireUser } from "@/server/session";
import { listTasks } from "@/server/tasks";
import { listAssignableUsers } from "@/server/users";
import { ProjectEditForm } from "../ProjectForms";

export const metadata: Metadata = { title: "تفاصيل المشروع" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const all = can(user.role, "project.view_all");
  const project = await getProject(id, all ? undefined : user.id);
  // An employee reaches a project only as a container for their own tasks; otherwise it "does not exist" for them.
  if (!project || (!all && !(await userHasTaskIn(id, user.id)))) notFound();

  const manage = can(user.role, "project.manage");
  const [tasks, clients, users] = await Promise.all([
    listTasks({ projectId: id, assigneeId: all ? undefined : user.id }),
    manage ? listClients() : Promise.resolve([]),
    manage ? listAssignableUsers() : Promise.resolve([]),
  ]);
  const today = todayInCairo();

  return (
    <>
      <Link href="/projects" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        كل المشاريع
      </Link>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {project.clientName ? <span className="font-semibold">{project.clientName}</span> : null}
            <ProjectStatusBadge status={project.status} />
            {project.overdueTasks > 0 ? <Badge tone="error">{project.overdueTasks} متأخرة</Badge> : null}
          </span>
        }
        actions={
          can(user.role, "task.create") ? (
            <Button href={`/tasks/new?project=${id}`} size="sm">
              <Plus aria-hidden="true" className="size-4" />
              مهمة جديدة
            </Button>
          ) : null
        }
      />

      {all ? (
        <Card className="mb-6 p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-muted">مدير المشروع</dt>
              <dd className="mt-0.5 text-base font-semibold">{project.managerName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">البدء</dt>
              <dd className="mt-0.5 text-base font-semibold">{formatDate(project.startDate)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">التسليم</dt>
              <dd className="mt-0.5 text-base font-semibold">{project.dueDate ? formatDate(project.dueDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">التقدم</dt>
              <dd className="mt-0.5 text-base font-semibold">
                {project.doneTasks} من {project.totalTasks} مهمة
              </dd>
            </div>
            {project.dealId ? (
              <div className="sm:col-span-4">
                <Link href={`/crm/deals/${project.dealId}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                  فتح الصفقة
                </Link>
              </div>
            ) : null}
            {project.notes ? (
              <div className="sm:col-span-4">
                <dt className="text-ink-muted">ملاحظات</dt>
                <dd className="mt-0.5 leading-8 whitespace-pre-wrap">{project.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-5">
        {BOARD_COLUMNS.map((status) => {
          const column = tasks.filter((task) => task.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="rounded-xl bg-canvas-alt/40 p-3">
              <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between text-sm font-bold">
                {TASK_STATUS_LABEL[status]}
                <span dir="ltr" className="font-mono text-xs text-ink-muted">
                  {column.length}
                </span>
              </h2>
              <ul className="grid gap-2.5">
                {column.length === 0 ? <li className="px-1 py-3 text-center text-xs text-ink-muted">—</li> : null}
                {column.map((task) => (
                  <TaskCard key={task.id} task={task} today={today} showAssignee={all} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {manage ? (
        <Card className="mt-8 max-w-3xl p-6">
          <h2 className="mb-4 text-lg font-bold">تعديل المشروع</h2>
          <ProjectEditForm
            id={id}
            status={project.status}
            values={{
              name: project.name,
              clientId: project.clientId ?? "",
              managerId: project.managerId ?? "",
              startDate: project.startDate,
              dueDate: project.dueDate ?? "",
              notes: project.notes,
            }}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            users={users}
          />
        </Card>
      ) : null}
    </>
  );
}
