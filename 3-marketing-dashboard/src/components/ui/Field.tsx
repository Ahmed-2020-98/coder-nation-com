import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared look for text inputs, selects and textareas (visible border, 44px touch height, clear focus). */
export const controlClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 text-ink placeholder:text-ink-muted/70 transition-colors duration-(--duration-fast) hover:border-ink-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

export const inputClass = cn(controlClass, "h-11");
export const textareaClass = cn(controlClass, "py-2.5 leading-7");

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  /** Shown at the end of the label row (e.g. a counter). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Visible label above the control (never placeholder-only), then hint, then the error next to the field. */
export function Field({ label, htmlFor, hint, error, aside, children, className }: FieldProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {aside ? <span className="text-xs text-ink-muted">{aside}</span> : null}
      </div>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm text-error-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
