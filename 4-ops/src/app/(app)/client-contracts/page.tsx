import type { Metadata } from "next";
import Link from "next/link";
import { NewClientContractForm } from "./ClientContractForms";
import { PageHeader } from "@/components/PageHeader";
import { ClientContractBadge } from "@/components/badges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listClientContracts, listClientTemplates, proposalsAwaitingContract } from "@/server/client-contracts";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "عقود العملاء" };

export default async function ClientContractsPage() {
  await requirePermission("client_contract.manage");
  const [contracts, templates, waiting] = await Promise.all([listClientContracts(), listClientTemplates(), proposalsAwaitingContract()]);
  const templateOptions = templates.map((t) => ({ id: t.id, title: t.title }));

  return (
    <>
      <PageHeader
        title="عقود العملاء"
        description="العقد بيتعمل من عرض العميل قبله: بياخد النطاق والأسعار والدفعات من العرض، والبنود من قالب. بيتطبع ويتوقّع، وكل دفعة بتوصل بتطلّع فاتورة."
        actions={
          <Button href="/client-contracts/templates" variant="secondary">
            القوالب ({templates.length})
          </Button>
        }
      />

      {waiting.length > 0 ? (
        <Card className="mb-7 p-6">
          <h2 className="mb-4 text-lg font-bold">عروض مقبولة لسه من غير عقد</h2>
          <ul className="grid gap-5">
            {waiting.map((p) => (
              <li key={p.id} className="grid gap-3 border-b border-line pb-5 last:border-0 last:pb-0">
                <p>
                  <Link href={`/proposals/${p.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                    <bdi dir="ltr">{p.number}</bdi> · {p.title}
                  </Link>
                  <span className="text-ink-muted"> · {p.clientName}</span>
                </p>
                <NewClientContractForm proposalId={p.id} templates={templateOptions} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {contracts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          لسه مفيش عقود. لما عميل يقبل عرض، هتلاقي زرار «اعمل العقد» في صفحة العرض.
        </p>
      ) : (
        <Card className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">عقود العملاء</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">الرقم</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">العميل / المشروع</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الإجمالي</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">المدفوع</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas-alt">
                    <td className="px-4 py-3 font-mono" dir="ltr">
                      <Link href={`/client-contracts/${c.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                        {c.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.clientName}</p>
                      <p className="text-ink-muted">{c.title}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatMoney(c.totalMinor, c.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={c.paidMinor >= c.totalMinor ? "font-semibold text-success-700" : undefined}>{formatMoney(c.paidMinor, c.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ClientContractBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(c.signedOn ?? c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
