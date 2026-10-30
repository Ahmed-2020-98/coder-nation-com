import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Check, ListChecks } from "lucide-react";
import { completeFollowUpAction } from "@/app/actions/crm";
import { CheckCard } from "@/components/CheckCard";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, TaskStatusBadge } from "@/components/task-badges";
import { Card } from "@/components/ui/Card";
import { isOverdue, todayInCairo } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { OPEN_STAGES, STAGE_LABEL } from "@/lib/crm-rules";
import { formatDateTime, isPast } from "@/lib/format";
import { checkPhase } from "@/lib/attendance-rules";
import { formatTime } from "@/lib/format";
import { myToday } from "@/server/attendance";
import { listFollowUps, stageCounts } from "@/server/crm";
import { can } from "@/server/permissions";
import { requireUser } from "@/server/session";
import { listTasks, taskCounts } from "@/server/tasks";

export const metadata: Metadata = { title: "الرئيسية" };

export default async function HomePage() {
  const user = await requireUser();
  const own = !can(user.role, "deal.view_all");
  const ownTasks = !can(user.role, "task.view_all");
  const [day, counts, followUps, myTasks, taskTotals] = await Promise.all([
    myToday(user.id),
    stageCounts(own ? user.id : undefined),
    listFollowUps({ openOnly: true, assigneeId: own ? user.id : undefined, limit: 15 }),
    // "My tasks" is always the person's own, whatever their role: managers see the whole team on /tasks.
    listTasks({ assigneeId: user.id }).then((list) => list.filter((task) => task.status !== "done").slice(0, 8)),
    taskCounts(ownTasks ? user.id : undefined),
  ]);
  const today = todayInCairo();

  return (
    <>
      <PageHeader title={`أهلًا ${user.name}`} description={own ? "الصفقات والمتابعات المسندة ليك." : "نظرة سريعة على المبيعات."} />

      {day ? (
        <CheckCard
          phase={checkPhase(day.status, day.record)}
          shift={`${day.schedule.startTime} - ${day.schedule.endTime}`}
          checkedInAt={day.record ? formatTime(day.record.checkIn) : null}
          checkedOutAt={day.record?.checkOut ? formatTime(day.record.checkOut) : null}
          lateMinutes={day.record?.lateMinutes ?? 0}
        />
      ) : null}

      <section aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className="mb-3 text-lg font-bold">
          الصفقات حسب المرحلة
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...OPEN_STAGES, "won" as const].map((stage) => (
            <Link key={stage} href="/crm" className="block rounded-xl">
              <Card interactive className="p-4">
                <dt className="text-xs text-ink-muted">{STAGE_LABEL[stage]}</dt>
                <dd dir="ltr" className="mt-1 text-start font-mono text-2xl font-bold">
                  {counts[stage]}
                </dd>
              </Card>
            </Link>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tasks-title" className="mt-9">
        <h2 id="tasks-title" className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold">
          <ListChecks aria-hidden="true" className="size-5 text-accent" />
          مهامي
          {taskTotals.overdue > 0 ? (
            <Link href="/tasks?overdue=1" className="rounded-full bg-error-500/15 px-3 py-0.5 text-xs font-medium text-error-700">
              {ownTasks ? `${taskTotals.overdue} متأخرة` : `${taskTotals.overdue} مهمة متأخرة في الفريق`}
            </Link>
          ) : null}
        </h2>
        {myTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-muted">مفيش مهام مسندة ليك. ✔</p>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {myTasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/tasks/${task.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                      {task.title}
                    </Link>
                    {task.projectName ? <p className="text-sm text-ink-muted">{task.projectName}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TaskStatusBadge status={task.status} />
                    {task.priority === "high" || task.priority === "urgent" ? <PriorityBadge priority={task.priority} /> : null}
                    {task.dueDate ? (
                      <span className={isOverdue(task.dueDate, task.status, today) ? "text-sm font-semibold text-error-700" : "text-sm text-ink-muted"}>
                        {isOverdue(task.dueDate, task.status, today) ? "متأخرة: " : ""}
                        {formatDate(task.dueDate)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="followups-title" className="mt-9">
        <h2 id="followups-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
          <CalendarClock aria-hidden="true" className="size-5 text-accent" />
          المتابعات المطلوبة
        </h2>
        {followUps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-muted">مفيش متابعات مفتوحة. ✔</p>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {followUps.map((item) => {
                const overdue = isPast(item.dueAt);
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/crm/deals/${item.dealId}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                        {item.dealTitle}
                      </Link>
                      <p className="text-sm text-ink-muted">
                        {item.clientName}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={overdue ? "text-sm font-semibold text-error-700" : "text-sm text-ink-muted"}>
                        {overdue ? "متأخرة: " : ""}
                        {formatDateTime(item.dueAt)}
                      </span>
                      <form action={completeFollowUpAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:border-accent hover:text-accent">
                          <Check aria-hidden="true" className="size-4" />
                          تمت
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
