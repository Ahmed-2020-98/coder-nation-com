const DATE_TIME = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
const DATE = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeZone: "Africa/Cairo" });
// A "YYYY-MM-DD" string is a calendar day, not an instant: it is read as noon UTC and printed in UTC, so no time zone
// (the server's, Cairo's summer/winter offset) can move it to the neighbouring day.
const DAY = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeZone: "UTC" });
const dayAtNoonUtc = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

export const formatDateTime = (value: Date): string => DATE_TIME.format(value);
export const formatDate = (value: Date | string): string => (typeof value === "string" ? DAY.format(dayAtNoonUtc(value)) : DATE.format(value));

/** For <input type="datetime-local">: "2026-11-05T14:30" in Cairo time. */
export function toLocalInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }).format(date);
  return parts.replace(" ", "T");
}

export const whatsappLinkFor = (phone: string | null): string | null => {
  if (!phone) return null;
  if (/^\+[0-9]{8,15}$/.test(phone)) return `https://wa.me/${phone.slice(1)}`;
  if (/^00[0-9]{8,15}$/.test(phone)) return `https://wa.me/${phone.slice(2)}`;
  return null;
};

/** Kept out of components: reading the clock during render is impure. */
export const isPast = (date: Date): boolean => date.getTime() < Date.now();

const DATE_LATIN = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeZone: "Africa/Cairo" });
const DAY_LATIN = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeZone: "UTC" });
/** "30 أكتوبر 2026": Western digits and a spelled-out month, for documents the client reads (no day/month ambiguity). */
export const formatDateLong = (value: Date | string): string => typeof value === "string" ? DAY_LATIN.format(dayAtNoonUtc(value)) : DATE_LATIN.format(value);

const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "09:05" on the office clock (Cairo), Western digits, for attendance tables. */
export const formatTime = (value: Date): string => TIME.format(value);

const MONTH = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2026-03" -> the month's name and year. */
export const formatMonth = (month: string): string => MONTH.format(new Date(`${month}-01T12:00:00Z`));
