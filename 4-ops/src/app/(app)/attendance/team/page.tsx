import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { AttendanceTabs, DayStatusBadge } from "@/components/attendance-ui";
import { Card } from "@/components/ui/Card";
import { formatTime } from "@/lib/format";
import { todayBoard } from "@/server/attendance";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "الفريق النهارده" };

export default async function TeamTodayPage() {
  await requirePermission("attendance.view_all");
  const board = await todayBoard();
  const tracked = board.filter((row) => row.schedule);
  const untracked = board.filter((row) => !row.schedule);
  const count = (...statuses: string[]) => tracked.filter((row) => row.status && statuses.includes(row.status)).length;

  return (
    <>
      <PageHeader title="الحضور والانصراف" description="حالة الفريق النهارده بتوقيت القاهرة." />
      <AttendanceTabs current="team" manager />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["حاضرين", count("present", "late")],
          ["متأخرين", count("late")],
          ["لم يسجّلوا", count("missing")],
          ["في إجازة", count("leave")],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd dir="ltr" className="mt-1 text-start font-mono text-2xl font-bold">
              {value}
            </dd>
          </Card>
        ))}
      </dl>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-120 text-sm">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="px-4 py-3 text-start font-semibold">الموظف</th>
              <th className="px-4 py-3 text-start font-semibold">الوردية</th>
              <th className="px-4 py-3 text-start font-semibold">الحالة</th>
              <th className="px-4 py-3 text-start font-semibold">الحضور</th>
              <th className="px-4 py-3 text-start font-semibold">الانصراف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {board.map((row) => (
              <tr key={row.userId}>
                <td className="px-4 py-2.5 font-semibold">
                  <Link href={`/attendance/people/${row.userId}`} className="underline-offset-4 hover:text-accent hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td dir="ltr" className="px-4 py-2.5 text-end font-mono text-ink-muted">
                  {row.schedule ? `${row.schedule.startTime}-${row.schedule.endTime}` : "—"}
                </td>
                <td className="px-4 py-2.5">{row.status ? <DayStatusBadge status={row.status} /> : <span className="text-ink-muted">مش متتبَّع (بدون وردية)</span>}</td>
                <td dir="ltr" className="px-4 py-2.5 text-end font-mono">
                  {row.record ? formatTime(row.record.checkIn) : "—"}
                </td>
                <td dir="ltr" className="px-4 py-2.5 text-end font-mono">
                  {row.record?.checkOut ? formatTime(row.record.checkOut) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {untracked.length > 0 ? <p className="mt-3 text-xs text-ink-muted">اضغط على اسم أي شخص عشان تحدد وردية له وتبدأ تتبّع حضوره.</p> : null}
    </>
  );
}
