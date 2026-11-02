import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientContractDocument } from "@/components/ClientContractDocument";
import { getClientContract } from "@/server/client-contracts";
import { getCompany } from "@/server/company";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const contract = await getClientContract((await params).id).catch(() => null);
  // The PDF's title (shown by viewers and used as its name when saved).
  return { title: contract ? `${contract.number} | ${contract.clientName}` : "عقد", robots: { index: false, follow: false } };
}

/** What headless Chrome prints into the PDF: the contract on a plain white A4 sheet. */
export default async function ClientContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client_contract.manage");
  const { id } = await params;
  const [contract, company] = await Promise.all([getClientContract(id), getCompany()]);
  if (!contract) notFound();
  return (
    <div data-tone="light" className="mx-auto w-full max-w-[210mm] bg-white px-[15mm]">
      <style>{"html, body { background: #fff !important; }"}</style>
      <ClientContractDocument contract={contract} company={company} />
    </div>
  );
}
