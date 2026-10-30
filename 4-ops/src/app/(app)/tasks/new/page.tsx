import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getDeal } from "@/server/crm";
import { listProjects } from "@/server/projects";
import { requirePermission } from "@/server/session";
import { listAssignableUsers } from "@/server/users";
import { TaskForm } from "../TaskForms";

export const metadata: Metadata = { title: "مهمة جديدة" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string; deal?: string }> }) {
  await requirePermission("task.create");
  const { project, deal } = await searchParams;
  const [users, projects, linkedDeal] = await Promise.all([listAssignableUsers(), listProjects(), deal ? getDeal(deal) : Promise.resolve(null)]);
  const projectId = projects.some((p) => p.id === project) ? project! : "";
  return (
    <>
      <PageHeader title="مهمة جديدة" description={linkedDeal ? `مرتبطة بالصفقة: ${linkedDeal.title}` : undefined} />
      <TaskForm
        users={users}
        projects={projects.filter((p) => p.status === "active" || p.status === "on_hold").map((p) => ({ id: p.id, name: p.name }))}
        defaults={{ projectId, dealId: linkedDeal?.id ?? "", clientId: linkedDeal?.clientId ?? "" }}
      />
    </>
  );
}
