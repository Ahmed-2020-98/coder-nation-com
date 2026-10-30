import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProposalBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listProposals } from "@/server/proposals";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "العروض" };

export default async function ProposalsPage() {
  await requirePermission("proposal.view");
  const proposals = await listProposals();
  return (
    <>
      <PageHeader title="العروض" description="العرض بيتعمل من صفحة الصفقة (زرار «عرض جديد لهذه الصفقة»)." />
      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">لسه مفيش عروض.</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">العروض</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">الرقم</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">العرض / العميل</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الإجمالي</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {proposals.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-canvas-alt">
                    <td className="px-4 py-3 font-mono" dir="ltr">
                      <Link href={`/proposals/${proposal.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                        {proposal.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{proposal.title}</p>
                      <p className="text-ink-muted">{proposal.clientName}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatMoney(proposal.totalMinor, proposal.currency)}</td>
                    <td className="px-4 py-3">
                      <ProposalBadge status={proposal.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(proposal.createdAt)}</td>
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
