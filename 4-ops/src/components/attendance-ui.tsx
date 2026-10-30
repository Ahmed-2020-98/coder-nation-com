import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { DAY_STATUS_LABEL, WEEKDAY_LABEL, shiftMonth, weekdayOf, type DayStatus } from "@/lib/attendance-rules";
import { formatMonth } from "@/lib/format";

const TONE: Record<DayStatus, "neutral" | "accent" | "success" | "error"> = {
  present: "success",
  late: "accent",
  leave: "accent",
  absent: "error",
  missing: "error",
  off: "neutral",
  pending: "neutral",
  upcoming: "neutral",
  before: "neutral",
};
export const DayStatusBadge = ({ status }: { status: DayStatus }) => <Badge tone={TONE[status]}>{DAY_STATUS_LABEL[status]}</Badge>;

/** "الثلاثاء 10" */
export const dayLabel = (iso: string): string => `${WEEKDAY_LABEL[weekdayOf(iso)]} ${Number(iso.slice(8))}`;

/** Sections of the attendance area. Everyone gets "حضوري"; owners and managers get the team views. */
export function AttendanceTabs({ current, manager }: { current: "me" | "team" | "report" | "leaves"; manager: boolean }) {
  const tabs = [
    { key: "me", href: "/attendance", label: "حضوري" },
    ...(manager
      ? [
          { key: "team", href: "/attendance/team", label: "الفريق النهارده" },
          { key: "report", href: "/attendance/report", label: "التقرير الشهري" },
          { key: "leaves", href: "/attendance/leaves", label: "الإجازات" },
        ]
      : []),
  ];
  return (
    <nav aria-label="أقسام الحضور" className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-semibold",
            tab.key === current ? "border-transparent bg-primary-500 text-on-primary" : "border-line-strong hover:border-accent hover:text-accent",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Previous / next month links that keep the rest of the path (the page decides what other params to carry). */
export function MonthNav({ month, base }: { month: string; base: string }) {
  const link = (m: string) => `${base}${base.includes("?") ? "&" : "?"}month=${m}`;
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link href={link(shiftMonth(month, -1))} aria-label="الشهر اللي قبله" className="grid size-10 place-items-center rounded-lg border border-line-strong hover:border-accent hover:text-accent">
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
      <h2 className="min-w-36 text-center text-lg font-bold">{formatMonth(month)}</h2>
      <Link href={link(shiftMonth(month, 1))} aria-label="الشهر اللي بعده" className="grid size-10 place-items-center rounded-lg border border-line-strong hover:border-accent hover:text-accent">
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
