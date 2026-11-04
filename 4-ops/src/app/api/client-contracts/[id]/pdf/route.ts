import { getClientContract } from "@/server/client-contracts";
import { text, toPrintPage } from "@/server/print-route";
import { requirePermission } from "@/server/session";

/** The client contract's PDF (owners and managers). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client_contract.manage");
  const { id } = await params;
  if (!(await getClientContract(id))) return text(404, "العقد مش موجود");
  return toPrintPage(`/client-contracts/${encodeURIComponent(id)}/print`);
}
