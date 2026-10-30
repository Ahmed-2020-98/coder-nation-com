import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { todayInCairo } from "@/lib/dates";
import { BOARD_COLUMNS, PRIORITIES, PRIORITY_LABEL, TASK_STATUS_LABEL, type Priority } from "@/lib/task-rules";
import { can } from "@/server/permissions";
import { requireUser } from "@/server/session";
import { listProjects } from "@/server/projects";
import { listTasks } from "@/server/tasks";
import { listAssignableUsers } from "@/server/users";

export const metadata: Metadata = { title: "المهام" };

type Search = { q?: string; assignee?: string; project?: string; priority?: string; overdue?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { q, assignee, project, priority, overdue } = await searchParams;
  const all = can(user.role, "task.view_all");
  const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);
  const tasks = await listTasks({
    // The employee's own id is forced here; a filter in the URL can never widen it.
    assigneeId: all ? uuid(assignee) : user.id,
    projectId: uuid(project),
    priority: (PRIORITIES as readonly string[]).includes(priority ?? "") ? (priority as Priority) : undefined,
    overdueOnly: overdue === "1",
    q,
    doneWithinDays: 14,
  });
  const [users, projects] = all ? await Promise.all([listAssignableUsers(), listProjects()]) : [[], []];
  const today = todayInCairo();

  return (
    <>
      <PageHeader
        title="المهام"
        description={all ? `${tasks.length} مهمة` : "المهام المسندة ليك."}
        actions={
          can(user.role, "task.create") ? (
            <Button href="/tasks/new" size="sm">
              <Plus aria-hidden="true" className="size-4" />
              مهمة جديدة
            </Button>
          ) : null
        }
      />

      <form role="search" action="/tasks" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">
            بحث
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
        </div>
        {all ? (
          <>
            <div>
              <label htmlFor="assignee" className="mb-1.5 block text-sm font-semibold">
                المسؤول
              </label>
              <select id="assignee" name="assignee" defaultValue={assignee ?? ""} className={`${inputClass} cursor-pointer`}>
                <option value="">الكل</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="project" className="mb-1.5 block text-sm font-semibold">
                المشروع
              </label>
              <select id="project" name="project" defaultValue={project ?? ""} className={`${inputClass} cursor-pointer`}>
                <option value="">الكل</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        <div>
          <label htmlFor="priority" className="mb-1.5 block text-sm font-semibold">
            الأولوية
          </label>
          <select id="priority" name="priority" defaultValue={priority ?? ""} className={`${inputClass} cursor-pointer`}>
            <option value="">الكل</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="overdue" value="1" defaultChecked={overdue === "1"} className="size-4 accent-primary-500" />
          المتأخرة بس
        </label>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          تطبيق
        </Button>
      </form>

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
      <p className="mt-4 text-xs text-ink-muted">المهام المنتهية بتظهر لمدة 14 يوم بعد إقفالها.</p>
    </>
  );
}
