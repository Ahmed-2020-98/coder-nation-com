import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ProjectStatusBadge } from "@/components/task-badges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { can } from "@/server/permissions";
import { listProjects } from "@/server/projects";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "المشاريع" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const all = can(user.role, "project.view_all");
  // An employee only meets projects through tasks assigned to them.
  const projects = await listProjects({ memberId: all ? undefined : user.id });
  return (
    <>
      <PageHeader
        title="المشاريع"
        description={all ? `${projects.length} مشروع` : "المشاريع اللي ليك فيها مهام."}
        actions={
          can(user.role, "project.manage") ? (
            <Button href="/projects/new" size="sm">
              <Plus aria-hidden="true" className="size-4" />
              مشروع جديد
            </Button>
          ) : null
        }
      />
      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">مفيش مشاريع لسه.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const percent = project.totalTasks === 0 ? 0 : Math.round((project.doneTasks / project.totalTasks) * 100);
            return (
              <li key={project.id}>
                <Card interactive className="h-full p-5">
                  <Link href={`/projects/${project.id}`} className="block text-lg font-bold underline-offset-4 after:absolute after:inset-0 hover:text-accent hover:underline">
                    {project.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-muted">{project.clientName ?? "من غير عميل"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <ProjectStatusBadge status={project.status} />
                    {project.overdueTasks > 0 ? <Badge tone="error">{project.overdueTasks} متأخرة</Badge> : null}
                    {project.dueDate ? <Badge>التسليم {formatDate(project.dueDate)}</Badge> : null}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                      <span>
                        {project.doneTasks} من {project.totalTasks} مهمة
                      </span>
                      <span dir="ltr" className="font-mono">
                        {percent}%
                      </span>
                    </div>
                    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم المشروع" className="h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
