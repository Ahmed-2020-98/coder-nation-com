import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import type { TimelineRow } from "@/server/parse/montage";

/**
 * The plan drawn to scale: one block per row, positioned by its time range. Decorative (the table below it carries
 * the same information in text), so it is hidden from assistive tech and only summarised in one sentence.
 */
export function TimelineRuler({ rows, total }: { rows: TimelineRow[]; total: number | null }) {
  const timed = rows.filter((row) => row.start !== null && row.end !== null);
  if (timed.length === 0 || !total || total <= 0) return null;

  const ticks = 5;
  // Short clips need fractions of a second, otherwise neighbouring ticks all read the same ("00:01 00:01").
  const label = (seconds: number) => (total < 20 ? `${seconds.toFixed(1)}s` : formatClock(seconds));
  return (
    <div>
      <p className="sr-only">
        الخطة بتغطي {formatClock(total)} موزّعة على {timed.length} مقاطع.
      </p>
      <div aria-hidden="true" className="relative">
        <div className="relative h-14 overflow-hidden rounded-lg bg-canvas-alt">
          {timed.map((row, index) => {
            const left = ((row.start ?? 0) / total) * 100;
            const width = (((row.end ?? 0) - (row.start ?? 0)) / total) * 100;
            return (
              <div
                key={`${row.index}-${index}`}
                title={`${row.time}${row.text ? ` • ${row.text}` : ""}`}
                className={cn(
                  "absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md border-s border-white/30 px-1 text-xs font-semibold",
                  index % 2 === 0 ? "bg-secondary-800 text-white" : "bg-secondary-600 text-white",
                  index === 0 && "bg-primary-500 text-on-primary",
                )}
                style={{ insetInlineStart: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
              >
                <span dir="ltr" className="truncate font-mono">{row.index}</span>
              </div>
            );
          })}
        </div>
        <div dir="ltr" className="mt-1.5 flex justify-between font-mono text-[0.7rem] text-ink-muted">
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span key={i}>{label((total / ticks) * i)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
