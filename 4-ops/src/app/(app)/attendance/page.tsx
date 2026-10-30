import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AttendanceTabs, DayStatusBadge, MonthNav, dayLabel } from "@/components/attendance-ui";
import { CheckCard } from "@/components/CheckCard";
import { Card } from "@/components/ui/Card";
import { WEEKDAY_LABEL, checkPhase, formatDuration, isValidMonth, monthOf } from "@/lib/attendance-rules";
import { todayInCairo } from "@/lib/dates";
import { formatTime } from "@/lib/format";
import { myToday, personMonth } from "@/server/attendance";
import { can } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "حضوري" };

export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requirePermission("attendance.record");
  const today = todayInCairo();
  const { month: asked } = await searchParams;
  const month = asked && isValidMonth(asked) ? asked : monthOf(today);
  const [day, data] = await Promise.all([myToday(user.id), personMonth(user.id, month)]);
  const manager = can(user.role, "attendance.view_all");

  return (
    <>
      <PageHeader title="الحضور والانصراف" />
      <AttendanceTabs current="me" manager={manager} />
      {!day || !data ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          مفيش وردية متحددة ليك لسه، فحضورك مش بيتتبّع. {manager ? "تقدر تحدد وردية من «الفريق النهارده»." : "كلّم المدير."}
        </p>
      ) : (
        <>
          <CheckCard
            phase={checkPhase(day.status, day.record)}
            shift={`${day.schedule.startTime} - ${day.schedule.endTime}`}
            checkedInAt={day.record ? formatTime(day.record.checkIn) : null}
            checkedOutAt={day.record?.checkOut ? formatTime(day.record.checkOut) : null}
            lateMinutes={day.record?.lateMinutes ?? 0}
          />
          <p className="mb-4 text-sm text-ink-muted">
            أيام الشغل: {day.schedule.workDays.map((d) => WEEKDAY_LABEL[d]).join("، ")} · مهلة التأخير {day.schedule.graceMinutes} دقيقة
          </p>
          <MonthNav month={month} base="/attendance" />
          <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["أيام الحضور", data.summary.presentDays],
              ["أيام التأخير", data.summary.lateDays],
              ["دقائق التأخير", data.summary.lateMinutes],
              ["أيام الغياب", data.summary.absentDays],
              ["أيام الإجازة", data.summary.leaveDays],
              ["ساعات العمل", formatDuration(data.summary.workedMinutes)],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd dir="ltr" className="mt-1 text-start font-mono text-2xl font-bold">
                  {value}
                </dd>
              </Card>
            ))}
          </dl>
          {data.summary.noCheckoutDays > 0 ? (
            <p role="status" className="mb-4 rounded-lg border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm">
              فيه {data.summary.noCheckoutDays} يوم من غير تسجيل انصراف. المدير هو اللي بيصلّحهم.
            </p>
          ) : null}
          <Card className="overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead>
                <tr className="border-b border-line text-start text-ink-muted">
                  <th className="px-4 py-3 text-start font-semibold">اليوم</th>
                  <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-start font-semibold">الحضور</th>
                  <th className="px-4 py-3 text-start font-semibold">الانصراف</th>
                  <th className="px-4 py-3 text-start font-semibold">التأخير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.summary.days
                  .filter((d) => d.status !== "before" && d.date <= today)
                  .reverse()
                  .map((d) => (
                    <tr key={d.date}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{dayLabel(d.date)}</td>
                      <td className="px-4 py-2.5">
                        <DayStatusBadge status={d.status} />
                      </td>
                      <td dir="ltr" className="px-4 py-2.5 text-end font-mono">
                        {d.record ? formatTime(d.record.checkIn) : "—"}
                      </td>
                      <td dir="ltr" className="px-4 py-2.5 text-end font-mono">
                        {d.record?.checkOut ? formatTime(d.record.checkOut) : "—"}
                      </td>
                      <td dir="ltr" className="px-4 py-2.5 text-end font-mono">
                        {d.record && d.record.lateMinutes > 0 ? `${d.record.lateMinutes}m` : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
