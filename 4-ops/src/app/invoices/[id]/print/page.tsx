import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintSheet } from "@/components/PrintSheet";
import { getClientContract } from "@/server/client-contracts";
import { getCompany } from "@/server/company";
import { getInvoice, paidThrough } from "@/server/invoices";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const invoice = await getInvoice((await params).id).catch(() => null);
  return { title: { absolute: invoice ? `${invoice.number} - ${invoice.clientName}` : "فاتورة" }, robots: { index: false, follow: false } };
}

/** What the browser prints to PDF: the invoice on a plain white A4 sheet. */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("invoice.issue");
  const invoice = await getInvoice((await params).id);
  if (!invoice) notFound();
  const [contract, company, paidMinor] = await Promise.all([getClientContract(invoice.contractId), getCompany(), paidThrough(invoice.id)]);
  if (!contract) notFound();
  return (
    <PrintSheet label={invoice.number} back={`/invoices/${invoice.id}`}>
      <InvoiceDocument invoice={invoice} contract={contract} company={company} paidMinor={paidMinor} />
    </PrintSheet>
  );
}
