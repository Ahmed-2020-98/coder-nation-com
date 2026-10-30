import type { Metadata } from "next";
import { CompanyForm } from "./CompanyForm";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { getCompany } from "@/server/company";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "بيانات الشركة" };

export default async function CompanyPage() {
  await requirePermission("company.edit");
  const company = await getCompany();
  return (
    <>
      <PageHeader title="بيانات الشركة" description="بتظهر في رأس كل عرض PDF." />
      <Card className="max-w-2xl p-6">
        <CompanyForm company={company} />
      </Card>
    </>
  );
}
