import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PriorityBadge } from "@/components/task-badges";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/dates";
import type { Task } from "@/server/tasks";

/** One task on a board or list. `today` is passed in so a whole page agrees on what "overdue" means. */
export function TaskCard({ task, today, showAssignee = true }: { task: Task; today: string; showAssignee?: boolean }) {
  const overdue = isOverdue(task.dueDate, task.status, today);
  return (
    <li className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
      <Link href={`/tasks/${task.id}`} className="block font-semibold underline-offset-4 hover:text-accent hover:underline">
        {task.title}
      </Link>
      {task.projectName || task.clientName ? <p className="mt-0.5 text-sm text-ink-muted">{[task.projectName, task.clientName].filter(Boolean).join(" · ")}</p> : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {task.priority === "high" || task.priority === "urgent" ? <PriorityBadge priority={task.priority} /> : null}
        {task.dueDate ? (
          <Badge tone={overdue ? "error" : "neutral"}>
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {overdue ? "متأخرة: " : ""}
            {formatDate(task.dueDate)}
          </Badge>
        ) : null}
      </div>
      {task.status === "blocked" && task.blockedReason ? <p className="mt-2 text-sm text-error-700">السبب: {task.blockedReason}</p> : null}
      {showAssignee ? <p className="mt-2 text-xs text-ink-muted">{task.assigneeName ? `المسؤول: ${task.assigneeName}` : "من غير مسؤول"}</p> : null}
    </li>
  );
}
