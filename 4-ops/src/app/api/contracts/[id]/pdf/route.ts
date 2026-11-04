import { getContract } from "@/server/contracts";
import { canAccessContract } from "@/server/permissions";
import { text, toPrintPage } from "@/server/print-route";
import { requirePermission } from "@/server/session";

/** The contract's PDF, for the owner and for the employee it was sent to (never anyone else's, never a draft to them). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contract.respond");
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract || !canAccessContract(user, contract)) return text(404, "العقد مش موجود");
  return toPrintPage(`/contracts/${encodeURIComponent(id)}/print`);
}
