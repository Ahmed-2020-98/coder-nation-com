import type { Metadata } from "next";
import Link from "next/link";
import { NewContractForm } from "./NewContractForm";
import { PageHeader } from "@/components/PageHeader";
import { ContractBadge } from "@/components/badges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { listContracts, listTemplates, type ContractSummary } from "@/server/contracts";
import { can } from "@/server/permissions";
import { requirePermission } from "@/server/session";
import { listAssignableUsers } from "@/server/users";

export const metadata: Metadata = { title: "العقود" };

export default async function ContractsPage() {
  const user = await requirePermission("contract.respond");
  const manage = can(user.role, "contract.manage");

  if (!manage) {
    const mine = await listContracts({ userId: user.id });
    return (
      <>
        <PageHeader title="عقودي" description="عقود العمل اللي اتبعتتلك. افتح العقد عشان تقراه وتوافق عليه." />
        <ContractTable contracts={mine} showEmployee={false} />
      </>
    );
  }

  const [contracts, templates, people] = await Promise.all([listContracts(), listTemplates(), listAssignableUsers()]);
  return (
    <>
      <PageHeader
        title="عقود الموظفين"
        description="اعمل عقد لعضو في الفريق من قالب، املا بياناته، وابعته. الموظف بيقراه ويوافق عليه من حسابه."
        actions={
          <Button href="/contracts/templates" variant="secondary">
            القوالب ({templates.length})
          </Button>
        }
      />
      <Card className="mb-7 p-6">
        <h2 className="mb-4 text-lg font-bold">عقد جديد</h2>
        {people.length === 0 ? (
          <p className="text-sm text-ink-muted">
            ضيف الموظف الأول من <Link href="/settings/users" className="font-semibold text-accent underline-offset-4 hover:underline">الفريق</Link>، العقد بيتربط بحسابه.
          </p>
        ) : (
          <NewContractForm people={people} templates={templates.map((t) => ({ id: t.id, title: t.title }))} />
        )}
      </Card>
      <ContractTable contracts={contracts} showEmployee />
    </>
  );
}

function ContractTable({ contracts, showEmployee }: { contracts: ContractSummary[]; showEmployee: boolean }) {
  if (contracts.length === 0) return <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">لسه مفيش عقود.</p>;
  return (
    <Card className="overflow-hidden">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">العقود</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              <th scope="col" className="px-4 py-3 text-start font-medium">الرقم</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{showEmployee ? "الموظف / الوظيفة" : "العقد"}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {contracts.map((c) => (
              <tr key={c.id} className="hover:bg-canvas-alt">
                <td className="px-4 py-3 font-mono" dir="ltr">
                  <Link href={`/contracts/${c.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                    {c.number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{showEmployee ? c.employeeName : c.title}</p>
                  <p className="text-ink-muted">{c.jobTitle}</p>
                </td>
                <td className="px-4 py-3">
                  <ContractBadge status={c.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(c.respondedAt ?? c.sentAt ?? c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
