import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "error";

const tones: Record<Tone, string> = {
  neutral: "border-line text-ink-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  // Success / error use the darkest-enough steps that still pass 4.5:1 on their own background
  success: "border-transparent bg-success-500/15 text-success-700 [[data-tone=navy]_&]:text-success-300",
  error: "border-transparent bg-error-500/15 text-error-700 [[data-tone=navy]_&]:text-error-300",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone; mono?: boolean };

export function Badge({ tone = "neutral", mono = false, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs leading-6 font-medium",
        mono && "font-mono",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
