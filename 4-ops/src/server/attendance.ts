import "server-only";
import { randomUUID } from "node:crypto";
import { addDays, cairoInstant, cairoMinutes, todayInCairo } from "@/lib/dates";
import {
  dayStatus,
  daysOfMonth,
  lateMinutesOnDay,
  summarizeMonth,
  toMinutes,
  type DayRecord,
  type DayStatus,
  type LeaveKind,
  type MonthSummary,
  type Schedule,
} from "@/lib/attendance-rules";
import { sql } from "./db";
import { fromJson, isDuplicateKey } from "./sql";

type Result = { ok: true } | { ok: false; error: string };

// ---------- shifts ----------

type ScheduleRow = { user_id: string; start_time: string; end_time: string; work_days: number[]; grace_minutes: number; tracked_since: string };
const toSchedule = (r: ScheduleRow): Schedule => ({ startTime: r.start_time.slice(0, 5), endTime: r.end_time.slice(0, 5), workDays: [...fromJson<number[]>(r.work_days)].sort(), graceMinutes: r.grace_minutes, trackedSince: r.tracked_since });
const SCHEDULE_COLUMNS = `user_id, date_format(start_time, '%H:%i') as start_time, date_format(end_time, '%H:%i') as end_time, work_days, grace_minutes, date_format(tracked_since, '%Y-%m-%d') as tracked_since`;

export async function getSchedule(userId: string): Promise<Schedule | null> {
  const [row] = await sql()<ScheduleRow[]>`select ${sql().unsafe(SCHEDULE_COLUMNS)} from work_schedules where user_id = ${userId}`;
  return row ? toSchedule(row) : null;
}

export type ShiftInput = { startTime: string; endTime: string; workDays: number[]; graceMinutes: number };

/** Creates or changes a person's shift. `tracked_since` is set once (today) and never moved, so history isn't rewritten. */
export async function saveSchedule(userId: string, input: ShiftInput): Promise<Result> {
  if (toMinutes(input.endTime) <= toMinutes(input.startTime)) return { ok: false, error: "نهاية الوردية لازم تبقى بعد بدايتها (الورديات اللي بتعدّي منتصف الليل مش مدعومة)" };
  const [user] = await sql()`select 1 from users where id = ${userId} and active`;
  if (!user) return { ok: false, error: "المستخدم مش موجود أو موقوف" };
  const db = sql();
  await db`
    insert into work_schedules (user_id, start_time, end_time, work_days, grace_minutes, tracked_since)
    values (${userId}, ${input.startTime}, ${input.endTime}, ${db.json(input.workDays)}, ${input.graceMinutes}, ${todayInCairo()})
    on duplicate key update start_time = values(start_time), end_time = values(end_time),
      work_days = values(work_days), grace_minutes = values(grace_minutes), updated_at = now(3)`;
  return { ok: true };
}

/** Stops tracking someone (their past records stay). Their absence is no longer counted. */
export async function removeSchedule(userId: string): Promise<boolean> {
  return (await sql()`delete from work_schedules where user_id = ${userId}`).count > 0;
}

// ---------- the person's own day ----------

type RecordRow = { id: string; user_id: string; work_date: string; check_in: Date; check_out: Date | null; late_minutes: number };
export type AttendanceRecord = DayRecord & { id: string; userId: string; workDate: string };
const toRecord = (r: RecordRow): AttendanceRecord => ({ id: r.id, userId: r.user_id, workDate: r.work_date, checkIn: r.check_in, checkOut: r.check_out, lateMinutes: r.late_minutes });
const RECORD_COLUMNS = `id, user_id, date_format(work_date, '%Y-%m-%d') as work_date, check_in, check_out, late_minutes`;

export async function recordsBetween(userId: string, from: string, to: string): Promise<AttendanceRecord[]> {
  const rows = await sql()<RecordRow[]>`select ${sql().unsafe(RECORD_COLUMNS)} from attendance where user_id = ${userId} and work_date between ${from} and ${to} order by work_date`;
  return rows.map(toRecord);
}

/** Check-in uses the server clock (never the device's) and the office's calendar day. One per day. */
export async function checkIn(userId: string, now: Date = new Date()): Promise<Result> {
  const schedule = await getSchedule(userId);
  if (!schedule) return { ok: false, error: "مفيش وردية متحددة ليك. كلّم المدير" };
  const late = lateMinutesOnDay(todayInCairo(now), cairoMinutes(now), schedule);
  try {
    await sql()`insert into attendance (id, user_id, work_date, check_in, late_minutes) values (${randomUUID()}, ${userId}, ${todayInCairo(now)}, ${now}, ${late})`;
    return { ok: true };
  } catch (error) {
    // The unique (user, day) index decides, atomically, who got there first.
    if (isDuplicateKey(error)) return { ok: false, error: "سجّلت حضورك النهارده بالفعل" };
    throw error;
  }
}

export async function checkOut(userId: string, now: Date = new Date()): Promise<Result> {
  const date = todayInCairo(now);
  const updated = await sql()`update attendance set check_out = ${now} where user_id = ${userId} and work_date = ${date} and check_out is null and check_in < ${now}`;
  if (updated.count > 0) return { ok: true };
  const [existing] = await sql()<{ check_out: Date | null }[]>`select check_out from attendance where user_id = ${userId} and work_date = ${date}`;
  if (!existing) return { ok: false, error: "سجّل حضورك الأول" };
  return { ok: false, error: existing.check_out ? "سجّلت انصرافك بالفعل" : "حاول تاني بعد لحظة" };
}

// ---------- leaves ----------

export type Leave = { id: string; userId: string; userName: string; kind: LeaveKind; startDate: string; endDate: string; note: string };
type LeaveRow = { id: string; user_id: string; user_name: string; kind: LeaveKind; start_date: string; end_date: string; note: string };
const toLeave = (r: LeaveRow): Leave => ({ id: r.id, userId: r.user_id, userName: r.user_name, kind: r.kind, startDate: r.start_date, endDate: r.end_date, note: r.note });

export async function leavesOverlapping(from: string, to: string, userId?: string): Promise<Leave[]> {
  const db = sql();
  const rows = await db<LeaveRow[]>`
    select l.id, l.user_id, u.name as user_name, l.kind, date_format(l.start_date, '%Y-%m-%d') as start_date, date_format(l.end_date, '%Y-%m-%d') as end_date, l.note
    from leaves l join users u on u.id = l.user_id
    where l.start_date <= ${to} and l.end_date >= ${from} ${userId ? db`and l.user_id = ${userId}` : db``}
    order by l.start_date desc, u.name limit 500`;
  return rows.map(toLeave);
}

export function leaveDateSet(leaves: readonly Leave[], from: string, to: string): Set<string> {
  const dates = new Set<string>();
  for (const leave of leaves) {
    for (let day = leave.startDate > from ? leave.startDate : from; day <= leave.endDate && day <= to; day = addDays(day, 1)) dates.add(day);
  }
  return dates;
}

export type NewLeave = { userIds: string[]; kind: LeaveKind; startDate: string; endDate: string; note: string };

/** One leave per person. A person who already has leave on any of these days is skipped (and counted), never doubled up. */
export async function addLeave(input: NewLeave, createdBy: string): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  if (input.endDate < input.startDate) return { ok: false, error: "نهاية الإجازة قبل بدايتها" };
  if (addDays(input.startDate, 365) < input.endDate) return { ok: false, error: "الإجازة أطول من سنة" };
  let created = 0;
  let skipped = 0;
  await sql().begin(async (tx) => {
    for (const userId of input.userIds) {
      // Locking the person's row makes two simultaneous requests for the same person take turns.
      const [user] = await tx`select 1 from users where id = ${userId} and active for update`;
      if (!user) {
        skipped++;
        continue;
      }
      const [clash] = await tx`select 1 from leaves where user_id = ${userId} and start_date <= ${input.endDate} and end_date >= ${input.startDate}`;
      if (clash) {
        skipped++;
        continue;
      }
      await tx`insert into leaves (id, user_id, kind, start_date, end_date, note, created_by) values (${randomUUID()}, ${userId}, ${input.kind}, ${input.startDate}, ${input.endDate}, ${input.note}, ${createdBy})`;
      created++;
    }
  });
  if (created === 0) return { ok: false, error: input.userIds.length === 1 ? "الموظف عنده إجازة في الفترة دي بالفعل" : "كل الموظفين المختارين عندهم إجازة في الفترة دي بالفعل" };
  return { ok: true, created, skipped };
}

export async function deleteLeave(id: string): Promise<boolean> {
  return (await sql()`delete from leaves where id = ${id}`).count > 0;
}

// ---------- manager edits (always with a reason, always in the trail) ----------

export type RecordEdit = { userId: string; date: string; checkInTime: string; checkOutTime: string | null; reason: string };

export async function saveRecord(input: RecordEdit, byUserId: string): Promise<Result> {
  if (input.date > todayInCairo()) return { ok: false, error: "مينفعش تسجّل حضور ليوم لسه ماجاش" };
  if (input.checkOutTime !== null && toMinutes(input.checkOutTime) <= toMinutes(input.checkInTime)) return { ok: false, error: "الانصراف لازم يبقى بعد الحضور" };
  return sql().begin(async (tx): Promise<Result> => {
    const [user] = await tx`select 1 from users where id = ${input.userId} for update`;
    if (!user) return { ok: false, error: "الموظف مش موجود" };
    // The office's wall clock (Cairo) turned into the instants we store.
    const times = { check_in: cairoInstant(input.date, input.checkInTime), check_out: input.checkOutTime === null ? null : cairoInstant(input.date, input.checkOutTime) };
    const [schedule] = await tx<ScheduleRow[]>`select ${tx.unsafe(SCHEDULE_COLUMNS)} from work_schedules where user_id = ${input.userId}`;
    const late = schedule ? lateMinutesOnDay(input.date, toMinutes(input.checkInTime), toSchedule(schedule)) : 0;
    const [old] = await tx<{ check_in: Date; check_out: Date | null }[]>`select check_in, check_out from attendance where user_id = ${input.userId} and work_date = ${input.date}`;
    await tx`
      insert into attendance (id, user_id, work_date, check_in, check_out, late_minutes) values (${randomUUID()}, ${input.userId}, ${input.date}, ${times.check_in}, ${times.check_out}, ${late})
      on duplicate key update check_in = values(check_in), check_out = values(check_out), late_minutes = values(late_minutes)`;
    await tx`
      insert into attendance_edits (id, user_id, work_date, edited_by, action, reason, old_check_in, old_check_out, new_check_in, new_check_out)
      values (${randomUUID()}, ${input.userId}, ${input.date}, ${byUserId}, ${old ? "update" : "create"}, ${input.reason}, ${old?.check_in ?? null}, ${old?.check_out ?? null}, ${times.check_in}, ${times.check_out})`;
    return { ok: true };
  });
}

export async function deleteRecord(userId: string, date: string, reason: string, byUserId: string): Promise<Result> {
  return sql().begin(async (tx): Promise<Result> => {
    const [old] = await tx<{ check_in: Date; check_out: Date | null }[]>`select check_in, check_out from attendance where user_id = ${userId} and work_date = ${date} for update`;
    if (!old) return { ok: false, error: "مفيش تسجيل في اليوم ده" };
    await tx`delete from attendance where user_id = ${userId} and work_date = ${date}`;
    await tx`
      insert into attendance_edits (id, user_id, work_date, edited_by, action, reason, old_check_in, old_check_out)
      values (${randomUUID()}, ${userId}, ${date}, ${byUserId}, 'delete', ${reason}, ${old.check_in}, ${old.check_out})`;
    return { ok: true };
  });
}

export type EditLogEntry = { id: string; workDate: string; action: "create" | "update" | "delete"; reason: string; editorName: string | null; oldCheckIn: Date | null; oldCheckOut: Date | null; newCheckIn: Date | null; newCheckOut: Date | null; createdAt: Date };

export async function editsBetween(userId: string, from: string, to: string): Promise<EditLogEntry[]> {
  const rows = await sql()<{ id: string; work_date: string; action: EditLogEntry["action"]; reason: string; name: string | null; old_check_in: Date | null; old_check_out: Date | null; new_check_in: Date | null; new_check_out: Date | null; created_at: Date }[]>`
    select e.id, date_format(e.work_date, '%Y-%m-%d') as work_date, e.action, e.reason, u.name, e.old_check_in, e.old_check_out, e.new_check_in, e.new_check_out, e.created_at
    from attendance_edits e left join users u on u.id = e.edited_by
    where e.user_id = ${userId} and e.work_date between ${from} and ${to} order by e.created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, workDate: r.work_date, action: r.action, reason: r.reason, editorName: r.name, oldCheckIn: r.old_check_in, oldCheckOut: r.old_check_out, newCheckIn: r.new_check_in, newCheckOut: r.new_check_out, createdAt: r.created_at }));
}

// ---------- the team ----------

export type BoardRow = { userId: string; name: string; schedule: Schedule | null; status: DayStatus | null; record: DayRecord | null };

/** Everyone active, with what today looks like for them. People without a shift have `schedule: null` (not tracked). */
export async function todayBoard(now: Date = new Date()): Promise<BoardRow[]> {
  const db = sql();
  const today = todayInCairo(now);
  const people = await db<(ScheduleRow & { id: string; name: string })[]>`
    select u.id, u.name, w.user_id, date_format(w.start_time, '%H:%i') as start_time, date_format(w.end_time, '%H:%i') as end_time, w.work_days, w.grace_minutes, date_format(w.tracked_since, '%Y-%m-%d') as tracked_since
    from users u left join work_schedules w on w.user_id = u.id where u.active order by u.name`;
  const [records, leaves] = await Promise.all([
    db<RecordRow[]>`select ${db.unsafe(RECORD_COLUMNS)} from attendance where work_date = ${today}`,
    leavesOverlapping(today, today),
  ]);
  const recordOf = new Map(records.map((r) => [r.user_id, toRecord(r)]));
  const onLeave = new Set(leaves.map((l) => l.userId));
  const nowMinutes = cairoMinutes(now);
  return people.map((p) => {
    const schedule = p.user_id ? toSchedule(p) : null;
    const record = recordOf.get(p.id) ?? null;
    return { userId: p.id, name: p.name, schedule, record, status: schedule ? dayStatus({ date: today, today, nowMinutes, schedule, record, onLeave: onLeave.has(p.id) }) : null };
  });
}

export type MonthRow = { userId: string; name: string; schedule: Schedule; summary: MonthSummary };

/** One row per tracked, active person for the month (the monthly report and its CSV). */
export async function monthReport(month: string, now: Date = new Date()): Promise<MonthRow[]> {
  const db = sql();
  const days = daysOfMonth(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const people = await db<(ScheduleRow & { id: string; name: string })[]>`
    select u.id, u.name, w.user_id, date_format(w.start_time, '%H:%i') as start_time, date_format(w.end_time, '%H:%i') as end_time, w.work_days, w.grace_minutes, date_format(w.tracked_since, '%Y-%m-%d') as tracked_since
    from users u join work_schedules w on w.user_id = u.id where u.active order by u.name`;
  const [records, leaves] = await Promise.all([
    db<RecordRow[]>`select ${db.unsafe(RECORD_COLUMNS)} from attendance where work_date between ${from} and ${to}`,
    leavesOverlapping(from, to),
  ]);
  const today = todayInCairo(now);
  const nowMinutes = cairoMinutes(now);
  return people.map((p) => {
    const schedule = toSchedule(p);
    const mine = new Map(records.filter((r) => r.user_id === p.id).map((r) => [r.work_date, toRecord(r) as DayRecord]));
    const leaveDates = leaveDateSet(leaves.filter((l) => l.userId === p.id), from, to);
    return { userId: p.id, name: p.name, schedule, summary: summarizeMonth({ month, today, nowMinutes, schedule, records: mine, leaveDates }) };
  });
}

/** One person's month (their own page, and the manager's page about them). */
export async function personMonth(userId: string, month: string, now: Date = new Date()): Promise<{ schedule: Schedule; summary: MonthSummary } | null> {
  const schedule = await getSchedule(userId);
  if (!schedule) return null;
  const days = daysOfMonth(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const [records, leaves] = await Promise.all([recordsBetween(userId, from, to), leavesOverlapping(from, to, userId)]);
  const summary = summarizeMonth({
    month,
    today: todayInCairo(now),
    nowMinutes: cairoMinutes(now),
    schedule,
    records: new Map(records.map((r) => [r.workDate, r as DayRecord])),
    leaveDates: leaveDateSet(leaves, from, to),
  });
  return { schedule, summary };
}

export type MyDay = { schedule: Schedule; record: DayRecord | null; status: DayStatus };

/** What today looks like for one person, or null when they aren't tracked. */
export async function myToday(userId: string, now: Date = new Date()): Promise<MyDay | null> {
  const schedule = await getSchedule(userId);
  if (!schedule) return null;
  const today = todayInCairo(now);
  const [[row], leaves] = await Promise.all([
    sql()<RecordRow[]>`select ${sql().unsafe(RECORD_COLUMNS)} from attendance where user_id = ${userId} and work_date = ${today}`,
    leavesOverlapping(today, today, userId),
  ]);
  const record = row ? toRecord(row) : null;
  return { schedule, record, status: dayStatus({ date: today, today, nowMinutes: cairoMinutes(now), schedule, record, onLeave: leaves.length > 0 }) };
}
