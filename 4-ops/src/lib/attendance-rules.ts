// Attendance vocabulary and the pure rules (what a day counts as, what a month adds up to). Safe to import from browser code.
import { addDays } from "./dates";

export const LEAVE_KINDS = ["annual", "sick", "unpaid", "official", "other"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const LEAVE_LABEL: Record<LeaveKind, string> = { annual: "سنوية", sick: "مرضية", unpaid: "بدون مرتب", official: "رسمية", other: "أخرى" };

/** 0 = Sunday, as in JavaScript's getUTCDay() and in the database. */
export const WEEKDAY_LABEL = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
export const DEFAULT_SHIFT: { startTime: string; endTime: string; workDays: number[]; graceMinutes: number } = { startTime: "09:00", endTime: "17:00", workDays: [0, 1, 2, 3, 4], graceMinutes: 15 };

export type Schedule = { startTime: string; endTime: string; workDays: number[]; graceMinutes: number; trackedSince: string };
export type DayRecord = { checkIn: Date; checkOut: Date | null; lateMinutes: number };

export type DayStatus =
  | "present" // checked in on time
  | "late" // checked in after the grace period
  | "leave" // on leave, no check-in
  | "absent" // a past working day with nothing
  | "off" // not a working day for this person
  | "pending" // today, shift hasn't started (or still inside the grace period)
  | "missing" // today, past the grace period, not checked in yet
  | "upcoming" // a future working day
  | "before"; // before this person was tracked

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  present: "حاضر",
  late: "متأخر",
  leave: "إجازة",
  absent: "غائب",
  off: "يوم راحة",
  pending: "لسه",
  missing: "لم يسجّل",
  upcoming: "قادم",
  before: "—",
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isTime = (value: string): boolean => TIME_RE.test(value);
export function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** 0 = Sunday, from a "YYYY-MM-DD" calendar day (no time zone involved). */
export const weekdayOf = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Minutes after the shift start, but only when that goes past the grace period; otherwise 0. */
export function lateMinutesFor(checkInMinutes: number, schedule: Pick<Schedule, "startTime" | "graceMinutes">): number {
  const after = checkInMinutes - toMinutes(schedule.startTime);
  return after > schedule.graceMinutes ? after : 0;
}

/** Lateness for a given day: only working days can be late (turning up on a rest day is never "late"). */
export function lateMinutesOnDay(date: string, checkInMinutes: number, schedule: Schedule): number {
  return schedule.workDays.includes(weekdayOf(date)) ? lateMinutesFor(checkInMinutes, schedule) : 0;
}

export function dayStatus(input: { date: string; today: string; nowMinutes: number; schedule: Schedule; record: DayRecord | null; onLeave: boolean }): DayStatus {
  const { date, today, nowMinutes, schedule, record, onLeave } = input;
  // A record always counts, even one a manager entered for a day before tracking started.
  if (record) return record.lateMinutes > 0 ? "late" : "present";
  if (date < schedule.trackedSince) return "before";
  if (!schedule.workDays.includes(weekdayOf(date))) return "off";
  if (onLeave) return "leave";
  if (date > today) return "upcoming";
  if (date < today) return "absent";
  return nowMinutes <= toMinutes(schedule.startTime) + schedule.graceMinutes ? "pending" : "missing";
}

export const isValidMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);
export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};
export function daysOfMonth(month: string): string[] {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const days: string[] = [];
  for (let day = first; day < next; day = addDays(day, 1)) days.push(day);
  return days;
}

export type MonthDay = { date: string; status: DayStatus; record: DayRecord | null };
export type MonthSummary = {
  days: MonthDay[];
  presentDays: number; // checked in, on time or late
  lateDays: number;
  lateMinutes: number;
  absentDays: number;
  leaveDays: number;
  workedMinutes: number; // only days with both a check-in and a check-out
  noCheckoutDays: number; // past days with a check-in but no check-out (a manager needs to fix these)
};

export function summarizeMonth(input: { month: string; today: string; nowMinutes: number; schedule: Schedule; records: ReadonlyMap<string, DayRecord>; leaveDates: ReadonlySet<string> }): MonthSummary {
  const { month, today, nowMinutes, schedule, records, leaveDates } = input;
  const summary: MonthSummary = { days: [], presentDays: 0, lateDays: 0, lateMinutes: 0, absentDays: 0, leaveDays: 0, workedMinutes: 0, noCheckoutDays: 0 };
  for (const date of daysOfMonth(month)) {
    const record = records.get(date) ?? null;
    const status = dayStatus({ date, today, nowMinutes, schedule, record, onLeave: leaveDates.has(date) });
    summary.days.push({ date, status, record });
    if (status === "present" || status === "late") summary.presentDays++;
    if (status === "late") {
      summary.lateDays++;
      summary.lateMinutes += record?.lateMinutes ?? 0;
    }
    if (status === "absent") summary.absentDays++;
    if (status === "leave") summary.leaveDays++;
    if (record?.checkOut) summary.workedMinutes += Math.floor((record.checkOut.getTime() - record.checkIn.getTime()) / 60_000);
    else if (record && date < today) summary.noCheckoutDays++;
  }
  return summary;
}

/** 95 -> "1:35" */
export const formatDuration = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

export type CheckPhase = "in" | "out" | "done" | "leave" | "off";
/** Which button the person gets today: check in, check out, nothing (done), or a note on a leave / rest day. */
export function checkPhase(status: DayStatus, record: Pick<DayRecord, "checkOut"> | null): CheckPhase {
  if (record) return record.checkOut ? "done" : "out";
  return status === "leave" ? "leave" : status === "off" ? "off" : "in";
}
