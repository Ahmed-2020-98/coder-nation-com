import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractDocument } from "@/components/ContractDocument";
import { getCompany } from "@/server/company";
import { getContract } from "@/server/contracts";
import { canAccessContract } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const contract = await getContract((await params).id).catch(() => null);
  // Not looked up for permission here: the title is only ever seen by someone the page itself lets in.
  return { title: contract ? `${contract.number} | ${contract.employeeName}` : "عقد", robots: { index: false, follow: false } };
}

/** What headless Chrome prints into the PDF: the same document the employee reads, on a plain white A4 sheet. */
export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contract.respond");
  const { id } = await params;
  const [contract, company] = await Promise.all([getContract(id), getCompany()]);
  if (!contract || !canAccessContract(user, contract)) notFound();
  return (
    <div data-tone="light" className="mx-auto w-full max-w-[210mm] bg-white px-[15mm]">
      <style>{"html, body { background: #fff !important; }"}</style>
      <ContractDocument contract={contract} company={company} />
    </div>
  );
}
