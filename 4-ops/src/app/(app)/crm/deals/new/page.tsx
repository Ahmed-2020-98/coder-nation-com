import type { Metadata } from "next";
import { NewDealForm } from "./NewDealForm";
import { PageHeader } from "@/components/PageHeader";
import { listClients } from "@/server/crm";
import { listAssignableUsers } from "@/server/users";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "صفقة جديدة" };

export default async function NewDealPage() {
  await requirePermission("deal.create");
  const [clients, users] = await Promise.all([listClients(), listAssignableUsers()]);
  return (
    <>
      <PageHeader title="صفقة جديدة" description="اختار عميل موجود أو اكتب بيانات عميل جديد." />
      <NewDealForm clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))} users={users} />
    </>
  );
}
