"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, RotateCcw, Square } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatClock, formatUsd } from "@/lib/format";
import { RUN_KIND_LABEL } from "@/lib/stages";
import { Button } from "@/components/ui/Button";
import { RunStatusChip, Spinner } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toaster";
import type { Run } from "@/server/db";
import { isFinalStatus, useRun } from "./useRun";

type Props = {
  runId: string | null;
  /** Called once when the run reaches a final state (refresh the page data here). */
  onFinished?: (run: Run) => void;
  /** Shown on failure/cancel; usually re-calls the action that started the run. */
  onRetry?: () => void;
  className?: string;
};

/** Seconds since `startedAt`, ticking once a second only while `active`. */
function useElapsed(startedAt: string | undefined, endedAt: string | null | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!startedAt) return 0;
  const end = endedAt ? Date.parse(endedAt) : now;
  return Math.max(0, (end - Date.parse(startedAt)) / 1000);
}

/**
 * Live view of an agent run: status, elapsed time, the steps it is taking, cost, cancel, and a recoverable error.
 * Steps are announced politely to screen readers; the error uses role="alert".
 */
export function RunPanel({ runId, onFinished, onRetry, className }: Props) {
  const run = useRun(runId);
  const toast = useToast();
  const [details, setDetails] = useState(false);
  const notified = useRef<string | null>(null);
  const active = Boolean(run && !isFinalStatus(run.status));
  const elapsed = useElapsed(run?.startedAt, run?.endedAt, active);

  useEffect(() => {
    if (run && isFinalStatus(run.status) && notified.current !== run.id) {
      notified.current = run.id;
      onFinished?.(run);
    }
  }, [run, onFinished]);

  if (!runId) return null;

  if (!run) {
    return (
      <div className={cn("rounded-xl border border-line bg-surface p-4", className)} aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner /> جاري الاتصال بالتشغيل…
        </div>
      </div>
    );
  }

  const failed = run.status === "failed" || run.status === "cancelled";
  const lastIndex = run.steps.length - 1;

  async function cancel() {
    try {
      await api(`/api/runs/${runId}/cancel`, { method: "POST" });
      toast.info("بيتم إلغاء التشغيل…");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الإلغاء");
    }
  }

  return (
    <section className={cn("fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-card", className)} aria-label={RUN_KIND_LABEL[run.kind]}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold">{RUN_KIND_LABEL[run.kind]}</h3>
          <RunStatusChip status={run.status} />
          {run.label ? (
            <span dir="ltr" className="font-mono text-xs text-ink-muted">
              {run.label}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span dir="ltr" className="font-mono" title="الوقت المنقضي">
            {formatClock(elapsed)}
          </span>
          {run.costUsd !== null ? (
            <span dir="ltr" className="font-mono" title="التكلفة التقديرية">
              {formatUsd(run.costUsd)}
            </span>
          ) : null}
          {active ? (
            <Button variant="secondary" size="sm" onClick={cancel}>
              <Square aria-hidden="true" className="size-3.5" />
              إلغاء
            </Button>
          ) : null}
        </div>
      </header>

      <div
        role="progressbar"
        aria-label="تقدم التشغيل"
        aria-valuetext={active ? "شغّال" : run.status === "succeeded" ? "اكتمل" : "توقف"}
        className={cn("h-1", active ? "indeterminate bg-line" : run.status === "succeeded" ? "bg-success-500" : "bg-error-500")}
      />

      {run.steps.length > 0 ? (
        <ol className="thin-scroll max-h-56 space-y-1.5 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
          {run.steps.map((step, index) => {
            const working = active && index === lastIndex;
            return (
              <li key={`${step.at}-${index}`} className="flex items-center gap-2.5">
                {working ? <Spinner className="size-3.5 text-accent" /> : <Check aria-hidden="true" className="size-3.5 text-success-700" strokeWidth={2.5} />}
                <span className={cn(working ? "font-medium text-ink" : "text-ink-muted")}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {failed ? (
        <div role="alert" className="border-t border-line bg-error-500/10 px-4 py-3">
          <p className="font-semibold text-error-700">{run.status === "cancelled" ? "اتلغى التشغيل" : "فشل التشغيل"}</p>
          {run.error ? <p className="mt-1 text-sm text-ink">{run.error}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry ? (
              <Button size="sm" onClick={onRetry}>
                <RotateCcw aria-hidden="true" className="size-3.5" />
                إعادة المحاولة
              </Button>
            ) : null}
            {run.steps.length > 0 ? (
              <button
                type="button"
                onClick={() => setDetails((v) => !v)}
                aria-expanded={details}
                className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
              >
                <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", details && "rotate-180")} />
                تفاصيل
              </button>
            ) : null}
          </div>
          {details ? (
            <pre dir="ltr" className="thin-scroll mt-2 max-h-40 overflow-auto rounded-lg bg-canvas-alt p-3 font-mono text-xs text-ink-muted">
              {JSON.stringify({ id: run.id, kind: run.kind, startedAt: run.startedAt, endedAt: run.endedAt, steps: run.steps.length }, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
