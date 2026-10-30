// Latin digits inside Arabic text read better next to the data (slugs, counts, timestamps), so "-u-nu-latn".
const LOCALE = "ar-EG-u-nu-latn";

const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });
const timeOnly = new Intl.DateTimeFormat(LOCALE, { timeStyle: "short" });

export const formatDateTime = (iso: string | null | undefined): string => (iso ? dateTime.format(new Date(iso)) : "—");
export const formatDate = (iso: string | null | undefined): string => (iso ? dateOnly.format(new Date(iso)) : "—");
export const formatTime = (iso: string | null | undefined): string => (iso ? timeOnly.format(new Date(iso)) : "—");

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
}

/** 83 -> "01:23" */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** "2026-10-30T18:30" for <input type="datetime-local"> from an ISO string, in the browser's time zone. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Inverse of toLocalInputValue: a datetime-local value is local time, stored as ISO (UTC). */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
