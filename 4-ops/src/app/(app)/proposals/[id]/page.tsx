import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Duplicate, MarkSent, Outcome } from "./ProposalActions";
import { ProposalEditor } from "./ProposalEditor";
import { PageHeader } from "@/components/PageHeader";
import { ProposalBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
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
    </>
  );
}
