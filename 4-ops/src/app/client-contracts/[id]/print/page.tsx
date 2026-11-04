import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientContractDocument } from "@/components/ClientContractDocument";
import { PrintSheet } from "@/components/PrintSheet";
import { getClientContract } from "@/server/client-contracts";
import { getCompany } from "@/server/company";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const contract = await getClientContract((await params).id).catch(() => null);
  // The PDF's title (shown by viewers and used as its name when saved).
  return { title: { absolute: contract ? `${contract.number} - ${contract.clientName}` : "عقد" }, robots: { index: false, follow: false } };
}

/** What the browser prints to PDF: the contract on a plain white A4 sheet. */
export default async function ClientContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client_contract.manage");
  const { id } = await params;
  const [contract, company] = await Promise.all([getClientContract(id), getCompany()]);
  if (!contract) notFound();
  return (
    <PrintSheet label={contract.number} back={`/client-contracts/${contract.id}`}>
      <ClientContractDocument contract={contract} company={company} />
    </PrintSheet>
  );
}
