import { blockingProblems } from "@/lib/proposal-rules";
import { text, toPrintPage } from "@/server/print-route";
import { getProposal } from "@/server/proposals";
import { requirePermission } from "@/server/session";

/** The proposal's PDF: refused while something blocks it, otherwise its print page. Same permission as everything else about proposals. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("proposal.export");
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return text(404, "العرض مش موجود");
  const problems = blockingProblems(proposal);
  if (problems.length > 0) return text(409, problems[0]);
  return toPrintPage(`/proposals/${encodeURIComponent(id)}/print`);
}
