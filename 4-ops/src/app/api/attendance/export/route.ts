import { formatDuration, isValidMonth, monthOf } from "@/lib/attendance-rules";
import { toCsv } from "@/lib/csv";
import { todayInCairo } from "@/lib/dates";
import { monthReport } from "@/server/attendance";
import { requirePermission } from "@/server/session";

/** The month's attendance summary as a spreadsheet-safe CSV. Same permission as the report page. */
export async function GET(request: Request) {
  await requirePermission("attendance.view_all");
  const asked = new URL(request.url).searchParams.get("month") ?? "";
  const month = isValidMonth(asked) ? asked : monthOf(todayInCairo());
  const rows = await monthReport(month);
  const csv = toCsv(
    ["الموظف", "الشهر", "أيام الحضور", "أيام التأخير", "دقائق التأخير", "أيام الغياب", "أيام الإجازة", "ساعات العمل", "أيام بدون انصراف"],
    rows.map((r) => [r.name, month, r.summary.presentDays, r.summary.lateDays, r.summary.lateMinutes, r.summary.absentDays, r.summary.leaveDays, formatDuration(r.summary.workedMinutes), r.summary.noCheckoutDays]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
