import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { deleteLeaveAction } from "@/app/actions/attendance";
import { PageHeader } from "@/components/PageHeader";
import { DayStatusBadge, MonthNav, dayLabel } from "@/components/attendance-ui";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LEAVE_LABEL, WEEKDAY_LABEL, daysOfMonth, formatDuration, isValidMonth, monthOf } from "@/lib/attendance-rules";
import { todayInCairo } from "@/lib/dates";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { editsBetween, leavesOverlapping, personMonth } from "@/server/attendance";
import { sql } from "@/server/db";
import { requirePermission } from "@/server/session";
import { getSchedule } from "@/server/attendance";
import { DeleteRecordForm, LeaveForm, RecordForm, ShiftForm, StopTrackingForm } from "../../AttendanceForms";

export const metadata: Metadata = { title: "حضور موظف" };

const ACTION_LABEL = { create: "إضافة", update: "تعديل", delete: "مسح" } as const;

export default async function PersonAttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  await requirePermission("attendance.view_all");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [person] = await sql()<{ name: string; email: string }[]>`select name, email from users where id = ${id} and active`;
  if (!person) notFound();

  const today = todayInCairo();
  const { month: asked } = await searchParams;
  const month = asked && isValidMonth(asked) ? asked : monthOf(today);
  const days = daysOfMonth(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const [schedule, data, edits, leaves] = await Promise.all([getSchedule(id), personMonth(id, month), editsBetween(id, from, to), leavesOverlapping(from, to, id)]);

  return (
    <>
      <Link href="/attendance/team" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        الفريق النهارده
      </Link>
      <PageHeader title={person.name} description={<span dir="ltr">{person.email}</span>} />

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          {data ? (
            <Card className="overflow-x-auto">
              <div className="px-5 pt-5">
                <MonthNav month={month} base={`/attendance/people/${id}`} />
                <p className="mb-4 text-sm text-ink-muted">
                  حضور {data.summary.presentDays} · تأخير {data.summary.lateDays} يوم ({data.summary.lateMinutes} دقيقة) · غياب {data.summary.absentDays} · إجازة {data.summary.leaveDays} · ساعات{" "}
                  <span dir="ltr">{formatDuration(data.summary.workedMinutes)}</span>
                  {data.summary.noCheckoutDays > 0 ? <span className="text-error-700"> · {data.summary.noCheckoutDays} يوم من غير انصراف</span> : null}
                </p>
              </div>
              <table className="w-full min-w-120 text-sm">
                <thead>
                  <tr className="border-y border-line text-ink-muted">
                    {["اليوم", "الحالة", "الحضور", "الانصراف", "التأخير"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start font-semibold">
                        {h}
                      </th>
                    ))}
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
                          {d.record && !d.record.checkOut && d.date < today ? <span className="ms-2 text-xs text-error-700">من غير انصراف</span> : null}
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
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-muted">الشخص ده مش متتبَّع لسه. حدد له وردية من اليمين عشان يبدأ التتبّع.</p>
          )}

          {data ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">سجل التعديلات</h2>
              {edits.length === 0 ? (
                <p className="text-sm text-ink-muted">مفيش تعديلات يدوية الشهر ده.</p>
              ) : (
                <ol className="grid gap-4">
                  {edits.map((e) => (
                    <li key={e.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-2 text-ink-muted">
                        <Badge tone={e.action === "delete" ? "error" : "accent"}>{ACTION_LABEL[e.action]}</Badge>
                        {e.editorName ?? "—"} · {formatDateTime(e.createdAt)} · يوم {formatDate(e.workDate)}
                      </p>
                      <p className="mt-1 leading-7">
                        {e.reason}
                        <span dir="ltr" className="ms-2 font-mono text-xs text-ink-muted">
                          {e.oldCheckIn ? `${formatTime(e.oldCheckIn)}-${e.oldCheckOut ? formatTime(e.oldCheckOut) : "…"}` : "∅"} → {e.newCheckIn ? `${formatTime(e.newCheckIn)}-${e.newCheckOut ? formatTime(e.newCheckOut) : "…"}` : "∅"}
                        </span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}
        </div>

        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold">الوردية</h2>
            {schedule ? (
              <p className="mb-4 text-sm text-ink-muted">
                بيتتبّع من <span dir="ltr">{formatDate(schedule.trackedSince)}</span> · {schedule.workDays.map((d) => WEEKDAY_LABEL[d]).join("، ")}
              </p>
            ) : null}
            <ShiftForm userId={id} schedule={schedule} />
            {schedule ? (
              <div className="mt-4 border-t border-line pt-4">
                <StopTrackingForm userId={id} />
              </div>
            ) : null}
          </Card>

          {data ? (
            <>
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-bold">تصحيح أو إضافة يوم</h2>
                <RecordForm userId={id} today={today} />
              </Card>
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-bold">مسح تسجيل غلط</h2>
                <DeleteRecordForm userId={id} today={today} />
              </Card>
            </>
          ) : null}

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">الإجازات</h2>
            <ul className="mb-5 grid gap-2.5 text-sm">
              {leaves.length === 0 ? <li className="text-ink-muted">مفيش إجازات الشهر ده.</li> : null}
              {leaves.map((leave) => (
                <li key={leave.id} className="flex items-center justify-between gap-3">
                  <span>
                    <Badge tone="accent">{LEAVE_LABEL[leave.kind]}</Badge> <span dir="ltr">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
                  </span>
                  <form action={deleteLeaveAction}>
                    <input type="hidden" name="id" value={leave.id} />
                    <button type="submit" className="cursor-pointer text-error-700 underline-offset-4 hover:underline">
                      حذف
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <LeaveForm userId={id} />
          </Card>
        </div>
      </div>
    </>
  );
}
