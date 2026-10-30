import { Check, CircleAlert, Loader, Minus } from "lucide-react";
import { RUN_STATUS_LABEL, type RunStatus } from "@/lib/stages";
import { cn } from "@/lib/cn";

const STYLE: Record<RunStatus, string> = {
  queued: "border-line text-ink-muted",
  running: "border-transparent bg-accent-soft text-accent",
  succeeded: "border-transparent bg-success-500/15 text-success-700",
  failed: "border-transparent bg-error-500/15 text-error-700",
  cancelled: "border-line text-ink-muted",
};

/** Run state as a chip: icon + text (never colour alone). */
export function RunStatusChip({ status, className }: { status: RunStatus; className?: string }) {
  const Icon = status === "succeeded" ? Check : status === "failed" ? CircleAlert : status === "cancelled" ? Minus : Loader;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-6 font-medium", STYLE[status], className)}>
      <Icon aria-hidden="true" className={cn("size-3.5", (status === "running" || status === "queued") && "spin")} strokeWidth={2.25} />
      {RUN_STATUS_LABEL[status]}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader aria-hidden="true" className={cn("spin size-4", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton h-4", className)} />;
}

/** "Nothing here yet" with the next step, so an empty page is never a dead end. */
export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      {children ? <div className="mt-2 max-w-md text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}
