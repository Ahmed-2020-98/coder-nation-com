import { content } from "@/content";
import { cn } from "@/lib/cn";

/** Temporary text logo: a "</>" tile + the brand name. Swap this file when the real logo arrives. */
export function Logo({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-primary-500 font-mono text-[0.8rem] font-bold text-on-primary"
      >
        {"</>"}
      </span>
      <span className="font-heading text-[1.15rem] leading-none font-bold text-ink">
        {content.brand.first}
        <span className="text-accent">{content.brand.second}</span>
      </span>
    </span>
  );
}
