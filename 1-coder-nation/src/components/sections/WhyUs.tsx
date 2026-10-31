import { GitCompare } from "lucide-react";
import type { SiteContent } from "@/content";
import { cn } from "@/lib/cn";
import { DynamicIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

export function WhyUs({ data: why, index }: { data: SiteContent["why"]; index: string }) {

  return (
    <Section id="why" tone="navy" labelledBy="why-title">
      <div
        aria-hidden="true"
        className="absolute -start-40 top-1/3 -z-10 size-[34rem] rounded-full bg-primary-500/10 blur-3xl"
      />

      <SectionHeader
        id="why-title"
        index={index}
        eyebrow={why.eyebrow}
        title={why.title}
        description={why.description}
      />

      <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        {/* "git diff": the pitch (templates vs custom) told as a code review */}
        <Reveal>
          <figure className="overflow-hidden rounded-xl border border-line bg-canvas-alt shadow-window">
            <figcaption
              dir="ltr"
              className="flex items-center gap-2 border-b border-line px-4 py-3 font-mono text-xs text-ink-muted"
            >
              <GitCompare aria-hidden="true" className="size-3.5 text-accent" />
              git diff {why.diffTitle}
            </figcaption>
            <ul className="py-2">
              {why.diff.map((line, i) => {
                const isAdd = line.type === "add";
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-3 border-s-2 px-4 py-3",
                      isAdd
                        ? "border-success-400 bg-success-500/10 text-success-300"
                        : "border-error-400 bg-error-500/10 text-error-300",
                    )}
                  >
                    <span aria-hidden="true" dir="ltr" className="w-4 shrink-0 text-center font-mono font-bold">
                      {isAdd ? "+" : "−"}
                    </span>
                    <span className={isAdd ? "font-medium" : "line-through decoration-error-300/60"}>
                      <span className="sr-only">{isAdd ? why.srAdd : why.srRemove} </span>
                      {line.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </figure>
        </Reveal>

        <ul className="grid gap-4 sm:grid-cols-2">
          {why.reasons.map((reason, i) => (
            <Reveal as="li" key={`${i}-${reason.title}`} delay={i * 80}>
              <div className="h-full rounded-xl border border-line bg-surface/60 p-5 transition-colors duration-(--duration-base) hover:border-accent">
                <span className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent">
                  <DynamicIcon name={reason.icon} className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold">{reason.title}</h3>
                <p className="mt-1.5 text-[0.95rem] text-ink-muted">{reason.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
