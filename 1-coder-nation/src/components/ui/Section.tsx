import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  id?: string;
  /** "navy" or "light": flips every semantic colour token inside the section. */
  tone?: "navy" | "light";
  /** Use the slightly different background of the tone (for neighbouring sections of the same tone). */
  alt?: boolean;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ id, tone = "light", alt = false, labelledBy, className, children }: SectionProps) {
  return (
    <section
      id={id}
      data-tone={tone}
      aria-labelledby={labelledBy}
      className={cn(
        "relative isolate overflow-clip py-(--section-y) text-ink",
        alt ? "bg-canvas-alt" : "bg-canvas",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-page px-(--gutter)">{children}</div>
    </section>
  );
}

type SectionHeaderProps = {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
};

/** Eyebrow styled like a code comment ("// 01 — الخدمات"), then title and intro. */
export function SectionHeader({ id, index, eyebrow, title, description, className }: SectionHeaderProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="flex items-center gap-3 text-sm font-semibold text-accent">
        <span dir="ltr" className="font-mono">
          {"// "}
          {index}
        </span>
        <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
        <span>{eyebrow}</span>
      </p>
      <h2 id={id} className="mt-4 text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.4] font-bold text-ink">
        {title}
      </h2>
      {description ? <p className="mt-4 text-lg text-ink-muted">{description}</p> : null}
    </div>
  );
}
