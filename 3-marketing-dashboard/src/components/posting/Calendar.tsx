"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CalendarItem } from "@/server/services/posting";

const LOCALE = "ar-EG-u-nu-latn";
const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const dayLabel = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });

// Week starts on Saturday (the usual week in the region). A Saturday reference date is used only to get the names.
const WEEK = Array.from({ length: 7 }, (_, i) => weekdayFormat.format(new Date(2024, 0, 6 + i)));

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type Props = {
  items: CalendarItem[];
  /** The card being edited: clicking a day schedules it for that date. null = read-only. */
  activeId: string | null;
  onPick?: (day: Date) => void;
  initialMonth?: string | null;
};

/** Month grid, RTL. Each day lists the posts scheduled on it; the day buttons set the open card's date. */
export function Calendar({ items, activeId, onPick, initialMonth }: Props) {
  const [cursor, setCursor] = useState(() => {
    const base = initialMonth ? new Date(initialMonth) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [today] = useState(() => new Date());

  const cells = useMemo(() => {
    const offset = (cursor.getDay() + 1) % 7; // Saturday = 0
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const day = i - offset + 1;
      return day >= 1 && day <= daysInMonth ? new Date(cursor.getFullYear(), cursor.getMonth(), day) : null;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      if (!item.scheduledAt) continue;
      const d = new Date(item.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} aria-label="الشهر السابق" className="grid size-10 place-items-center rounded-lg border border-line hover:border-accent">
          <ChevronRight aria-hidden="true" className="size-4 ltr:rotate-180" />
        </button>
        <h3 aria-live="polite" className="text-base font-bold">{monthFormat.format(cursor)}</h3>
        <button type="button" onClick={() => move(1)} aria-label="الشهر التالي" className="grid size-10 place-items-center rounded-lg border border-line hover:border-accent">
          <ChevronLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
        </button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1 text-center">
        <caption className="sr-only">تقويم النشر: {monthFormat.format(cursor)}</caption>
        <thead>
          <tr>
            {WEEK.map((name) => (
              <th key={name} scope="col" className="pb-1 text-[0.7rem] font-medium text-ink-muted">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (!day) return <td key={col} />;
                const list = byDay.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? [];
                const isToday = sameDay(day, today);
                const mine = list.some((item) => item.id === activeId);
                return (
                  <td key={col} className="align-top">
                    <button
                      type="button"
                      disabled={!onPick}
                      onClick={() => onPick?.(day)}
                      aria-label={`${dayLabel.format(day)}${list.length ? `: ${list.length} بوست` : ""}`}
                      className={cn(
                        "flex min-h-14 w-full flex-col items-center rounded-lg border px-0.5 py-1 text-xs transition-colors",
                        mine ? "border-primary-500 bg-accent-soft" : "border-line hover:border-line-strong",
                        isToday && !mine && "border-secondary-700",
                        !onPick && "cursor-default",
                      )}
                    >
                      <span dir="ltr" className={cn("font-mono text-[0.8rem]", isToday && "rounded-full bg-secondary-800 px-1.5 text-white")}>{day.getDate()}</span>
                      {list.slice(0, 2).map((item) => (
                        <span key={item.id} className={cn("mt-0.5 w-full truncate rounded px-0.5 text-[0.65rem] leading-4", item.id === activeId ? "bg-primary-500 text-on-primary" : "bg-canvas-alt text-ink")} title={item.title}>
                          {item.title}
                        </span>
                      ))}
                      {list.length > 2 ? <span dir="ltr" className="font-mono text-[0.65rem] text-ink-muted">+{list.length - 2}</span> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
