import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { ContractEditor } from "./ContractEditor";
import { DuplicateContract, RespondToContract, SendContract, WithdrawContract } from "./ContractActions";
import { ContractDocument } from "@/components/ContractDocument";
import { PageHeader } from "@/components/PageHeader";
import { ContractBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { contractProblems } from "@/lib/contract-rules";
import { formatDateTime } from "@/lib/format";
import { getCompany } from "@/server/company";
import { getContract } from "@/server/contracts";
import { can, canAccessContract } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "العقد" };

const pdfLink = (id: string) => (
  <a href={`/api/contracts/${id}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-5 font-semibold hover:border-accent hover:text-accent">
    <Download aria-hidden="true" className="size-4" />
    تحميل PDF
  </a>
);

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contract.respond");
  const { id } = await params;
  const contract = await getContract(id);
  // Someone else's contract, or a draft that isn't theirs to see yet: as if it didn't exist.
  if (!contract || !canAccessContract(user, contract)) notFound();
  const manage = can(user.role, "contract.manage");

  const status = (
    <span className="flex flex-wrap items-center gap-2">
      <span dir="ltr" className="font-mono">{contract.number}</span>
      <ContractBadge status={contract.status} />
      {contract.sentAt ? <span className="text-sm">· اتبعت {formatDateTime(contract.sentAt)}</span> : null}
      {contract.respondedAt ? <span className="text-sm">· اترد عليه {formatDateTime(contract.respondedAt)}</span> : null}
    </span>
  );

  if (!manage) {
    const company = await getCompany();
    return (
      <>
        <Link href="/contracts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
          <ArrowRight aria-hidden="true" className="size-4" />
          عقودي
        </Link>
        <PageHeader title={contract.title} description={status} actions={pdfLink(contract.id)} />
        <Card className="p-6 sm:p-9">
          <ContractDocument contract={contract} company={company} />
        </Card>
        {contract.status === "sent" ? (
          <Card className="mt-6 p-6">
            <h2 className="mb-4 text-lg font-bold">ردّك على العقد</h2>
            <RespondToContract id={contract.id} />
          </Card>
        ) : contract.status === "declined" ? (
          <p className="mt-6 text-sm text-ink-muted">رفضت العقد ده. لو اتعدّل هيوصلك عقد جديد.</p>
        ) : null}
      </>
    );
  }

  const problems = contractProblems(contract);
  return (
    <>
      <Link href="/contracts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        العقود
      </Link>
      <PageHeader title={`${contract.employeeName}: ${contract.title}`} description={status} actions={pdfLink(contract.id)} />

      {contract.status !== "draft" ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            {contract.status === "sent" ? "العقد عند الموظف ومقفول للتعديل." : null}
            {contract.status === "accepted" ? "الموظف وافق على العقد، فمقفول نهائيًا. أي تعديل بيبقى عقد جديد برقم جديد." : null}
            {contract.status === "declined" ? `الموظف رفض العقد${contract.declineReason ? `: «${contract.declineReason}»` : "."} اعمل نسخة معدّلة وابعتها.` : null}
          </p>
          <DuplicateContract id={contract.id} />
        </Card>
      ) : null}

      <ContractEditor contract={contract} />

      <Card className="mt-6 grid gap-4 p-6">
        <h2 className="text-lg font-bold">حالة العقد</h2>
        {contract.status === "draft" ? <SendContract id={contract.id} problem={problems[0] ?? null} /> : null}
        {contract.status === "sent" ? <WithdrawContract id={contract.id} /> : null}
        {contract.status === "accepted" || contract.status === "declined" ? <p className="text-sm text-ink-muted">اتسجّل رد الموظف.</p> : null}
      </Card>
    </>
  );
}
