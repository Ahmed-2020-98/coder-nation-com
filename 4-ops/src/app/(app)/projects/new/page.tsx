import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { listClients } from "@/server/crm";
import { requirePermission } from "@/server/session";
import { listAssignableUsers } from "@/server/users";
import { NewProjectForm } from "../ProjectForms";

export const metadata: Metadata = { title: "مشروع جديد" };

export default async function NewProjectPage() {
  await requirePermission("project.manage");
  const [clients, users] = await Promise.all([listClients(), listAssignableUsers()]);
  return (
    <>
      <PageHeader title="مشروع جديد" description="المشاريع الجاية من صفقة بتتعمل بزرار «ابدأ المشروع» في صفحة الصفقة." />
      <NewProjectForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} users={users} />
    </>
  );
}
