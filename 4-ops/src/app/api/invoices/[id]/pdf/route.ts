import { getInvoice } from "@/server/invoices";
import { text, toPrintPage } from "@/server/print-route";
import { requirePermission } from "@/server/session";

/** The invoice's PDF (owners and managers). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("invoice.issue");
  const { id } = await params;
  if (!(await getInvoice(id))) return text(404, "الفاتورة مش موجودة");
  return toPrintPage(`/invoices/${encodeURIComponent(id)}/print`);
}
