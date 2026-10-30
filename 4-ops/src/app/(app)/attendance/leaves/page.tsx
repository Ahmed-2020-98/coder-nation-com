import type { Metadata } from "next";
import Link from "next/link";
import { deleteLeaveAction } from "@/app/actions/attendance";
import { PageHeader } from "@/components/PageHeader";
import { AttendanceTabs } from "@/components/attendance-ui";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LEAVE_LABEL } from "@/lib/attendance-rules";
import { addDays, todayInCairo } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { leavesOverlapping, todayBoard } from "@/server/attendance";
import { requirePermission } from "@/server/session";
import { LeaveForm } from "../AttendanceForms";

export const metadata: Metadata = { title: "الإجازات" };

export default async function LeavesPage() {
  await requirePermission("leave.manage");
  const today = todayInCairo();
  // Last 30 days and the next year: what is happening, what just happened, and what is planned.
  const [leaves, board] = await Promise.all([leavesOverlapping(addDays(today, -30), addDays(today, 365)), todayBoard()]);
  const tracked = board.filter((row) => row.schedule).map((row) => ({ id: row.userId, name: row.name }));
  return (
    <>
      <PageHeader title="الحضور والانصراف" description="الإجازات بتتسجّل لكل موظف. الأيام دي مش بتتحسب غياب." />
      <AttendanceTabs current="leaves" manager />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-120 text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                {["الموظف", "النوع", "الفترة", "ملاحظة", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                    مفيش إجازات في الفترة دي.
                  </td>
                </tr>
              ) : null}
              {leaves.map((leave) => (
                <tr key={leave.id}>
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/attendance/people/${leave.userId}`} className="underline-offset-4 hover:text-accent hover:underline">
                      {leave.userName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone="accent">{LEAVE_LABEL[leave.kind]}</Badge>
                  </td>
                  <td dir="ltr" className="px-4 py-2.5 text-end whitespace-nowrap">
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{leave.note || "—"}</td>
                  <td className="px-4 py-2.5">
                    <form action={deleteLeaveAction}>
                      <input type="hidden" name="id" value={leave.id} />
                      <button type="submit" className="cursor-pointer text-error-700 underline-offset-4 hover:underline">
                        حذف
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">إجازة جديدة</h2>
          <LeaveForm users={tracked} />
        </Card>
      </div>
    </>
  );
}
