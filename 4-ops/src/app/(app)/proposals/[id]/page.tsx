import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { NewClientContractForm } from "../../client-contracts/ClientContractForms";
import { Duplicate, MarkSent, Outcome } from "./ProposalActions";
import { ProposalEditor } from "./ProposalEditor";
import { PageHeader } from "@/components/PageHeader";
import { ClientContractBadge, ProposalBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listClientContracts, listClientTemplates } from "@/server/client-contracts";
import { getProposal } from "@/server/proposals";
import { can } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "العرض" };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("proposal.view");
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();
  const editable = can(user.role, "proposal.edit");
  const contracting = proposal.status === "accepted" && can(user.role, "client_contract.manage");
  const [contracts, templates] = contracting ? await Promise.all([listClientContracts({ proposalId: proposal.id }), listClientTemplates()]) : [[], []];

  return (
    <>
      <Link href={`/crm/deals/${proposal.dealId}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        الصفقة: {proposal.dealTitle}
      </Link>
      <PageHeader
        title={proposal.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-mono">{proposal.number}</span>
            <ProposalBadge status={proposal.status} />
            <span>{proposal.clientName}</span>
            {proposal.sentAt ? <span className="text-sm">· اتبعت {formatDateTime(proposal.sentAt)}</span> : null}
          </span>
        }
      />

      {proposal.status !== "draft" ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">العرض اتبعت للعميل فمقفول للتعديل (الأرقام اللي عند العميل لازم تفضل زي ما هي). لو عايز تعدّل اعمل نسخة جديدة برقم جديد.</p>
          {editable ? <Duplicate id={proposal.id} /> : null}
        </Card>
      ) : null}

      <ProposalEditor proposal={proposal} />

      {editable ? (
        <Card className="mt-6 grid gap-4 p-6">
          <h2 className="text-lg font-bold">حالة العرض</h2>
          {proposal.status === "draft" ? <MarkSent id={proposal.id} /> : null}
          {proposal.status === "sent" ? <Outcome id={proposal.id} /> : null}
          {proposal.status === "accepted" || proposal.status === "rejected" ? <p className="text-sm text-ink-muted">اتسجّلت النتيجة. النتيجة النهائية للصفقة (فاز / خسر) بتتحدد من صفحة الصفقة.</p> : null}
        </Card>
      ) : null}

      {contracting ? (
        <Card className="mt-6 grid gap-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileCheck2 aria-hidden="true" className="size-5 text-accent" />
            عقد العميل
          </h2>
          {contracts.length > 0 ? (
            <ul className="grid gap-2.5 text-sm">
              {contracts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/client-contracts/${c.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                    <bdi dir="ltr">{c.number}</bdi>
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="text-ink-muted">مدفوع {formatMoney(c.paidMinor, c.currency)} من {formatMoney(c.totalMinor, c.currency)}</span>
                    <ClientContractBadge status={c.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {contracts.every((c) => c.status === "cancelled") ? (
            <>
              <p className="text-sm text-ink-muted">العميل قبل العرض. اعمل العقد: هياخد النطاق والأسعار والدفعات من العرض ده، وتكمّل بيانات العميل والبنود.</p>
              <NewClientContractForm proposalId={proposal.id} templates={templates.map((t) => ({ id: t.id, title: t.title }))} />
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
