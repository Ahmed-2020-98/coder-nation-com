import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AttendanceTabs, MonthNav } from "@/components/attendance-ui";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDuration, isValidMonth, monthOf } from "@/lib/attendance-rules";
import { todayInCairo } from "@/lib/dates";
import { monthReport } from "@/server/attendance";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "التقرير الشهري" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("attendance.view_all");
  const { month: asked } = await searchParams;
  const month = asked && isValidMonth(asked) ? asked : monthOf(todayInCairo());
  const rows = await monthReport(month);
  return (
    <>
      <PageHeader
        title="الحضور والانصراف"
        description="ملخص الشهر لكل موظف متتبَّع."
        actions={
          <Button href={`/api/attendance/export?month=${month}`} variant="secondary" size="sm" download>
            <Download aria-hidden="true" className="size-4" />
            تصدير CSV
          </Button>
        }
      />
      <AttendanceTabs current="report" manager />
      <MonthNav month={month} base="/attendance/report" />
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">مفيش موظفين متتبَّعين لسه. حدد وردية لأي شخص من «الفريق النهارده».</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                {["الموظف", "حضور", "تأخير (أيام)", "تأخير (دقايق)", "غياب", "إجازة", "ساعات العمل", "بدون انصراف"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/attendance/people/${row.userId}?month=${month}`} className="underline-offset-4 hover:text-accent hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  {[row.summary.presentDays, row.summary.lateDays, row.summary.lateMinutes, row.summary.absentDays, row.summary.leaveDays, formatDuration(row.summary.workedMinutes), row.summary.noCheckoutDays].map((value, index) => (
                    <td key={index} dir="ltr" className="px-4 py-2.5 text-end font-mono">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
