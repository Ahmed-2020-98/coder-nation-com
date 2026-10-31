// Calendar-day arithmetic on "YYYY-MM-DD" strings. No Date objects cross a time zone: a due date is a day, not an instant.

const MS_PER_DAY = 86_400_000;

const toUtc = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtc(toUtc(value)) === value;
export const addDays = (iso: string, days: number): string => fromUtc(toUtc(iso) + days * MS_PER_DAY);

/** Today in Cairo, as "YYYY-MM-DD" (the office's calendar, whatever the server's time zone is). */
export function todayInCairo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Cairo", dateStyle: "short" }).format(now);
}

/** The instant at which the Cairo wall clock shows `date` at `time` ("HH:MM"). Handles Egypt's daylight saving time. */
export function cairoInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  // How far Cairo's clock is ahead of UTC at a given instant, in ms.
  const offsetAt = (at: number): number => {
    const parts = formatter.formatToParts(new Date(at));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(at / 1000) * 1000;
  };
  // Two passes settle it, also when the guess lands on the other side of a daylight-saving change.
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant);
}

/** Late = it has a due day that is before today and the work isn't done. */
export const isOverdue = (dueDate: string | null, status: string, today: string): boolean => dueDate !== null && status !== "done" && dueDate < today;

/** Minutes since midnight on the office's clock (Cairo), e.g. 09:30 -> 570. */
export function cairoMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}
