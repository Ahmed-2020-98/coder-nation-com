import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/lead-contact";
import { STATUS_LABEL } from "@/lib/lead-rules";
import { isLeadStatus, leadsForExport } from "@/server/leads";
import { requireAdmin } from "@/server/session";

/** CSV of the leads (honouring the list's filters). Same gate as every other admin entry point. */
export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const rows = await leadsForExport({ status: isLeadStatus(status) ? status : undefined, q: params.get("q") ?? undefined });
  const csv = toCsv(
    ["الاسم", "الهاتف", "الإيميل", "نوع المشروع", "التفاصيل", "الحالة", "ملاحظة", "التاريخ"],
    rows.map((lead) => [lead.name, lead.phone, lead.email, lead.service, lead.message, STATUS_LABEL[lead.status], lead.note, formatDateTime(lead.createdAt)]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
