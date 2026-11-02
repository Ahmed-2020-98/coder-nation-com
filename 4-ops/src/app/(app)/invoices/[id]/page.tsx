import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { VoidInvoice } from "../../client-contracts/ClientContractForms";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";
import { getClientContract } from "@/server/client-contracts";
import { getCompany } from "@/server/company";
import { getInvoice, paidThrough } from "@/server/invoices";
import { can } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "فاتورة" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("invoice.issue");
  const invoice = await getInvoice((await params).id);
  if (!invoice) notFound();
  const [contract, company, paidMinor] = await Promise.all([getClientContract(invoice.contractId), getCompany(), paidThrough(invoice.id)]);
  if (!contract) notFound();

  return (
    <>
      <Link href={`/client-contracts/${contract.id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        العقد: <bdi dir="ltr">{contract.number}</bdi> · {contract.clientName}
      </Link>
      <PageHeader
        title={`فاتورة ${invoice.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceBadge status={invoice.status} />
            <span className="text-sm">اتسجّلت {formatDateTime(invoice.createdAt)}</span>
            {invoice.voidedAt ? <span className="text-sm">· اتلغت {formatDateTime(invoice.voidedAt)}</span> : null}
          </span>
        }
        actions={
          <a href={`/api/invoices/${invoice.id}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-5 font-semibold hover:border-accent hover:text-accent">
            <Download aria-hidden="true" className="size-4" />
            تحميل PDF
          </a>
        }
      />
      <Card className="p-6 sm:p-9">
        <InvoiceDocument invoice={invoice} contract={contract} company={company} paidMinor={paidMinor} />
      </Card>
      {invoice.status === "issued" && can(user.role, "invoice.void") ? (
        <Card className="mt-6 p-6">
          <details>
            <summary className="cursor-pointer font-semibold">إلغاء الفاتورة</summary>
            <div className="mt-4">
              <VoidInvoice id={invoice.id} />
            </div>
          </details>
        </Card>
      ) : null}
    </>
  );
}
