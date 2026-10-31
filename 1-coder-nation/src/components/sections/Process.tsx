import { Check } from "lucide-react";
import type { SiteContent } from "@/content";
import { Reveal } from "@/components/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/** The workflow drawn as a git history: one commit per stage, newest at the bottom. */
export function Process({ data: process, index }: { data: SiteContent["process"]; index: string }) {

  return (
    <Section id="process" tone="light" labelledBy="process-title">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            id="process-title"
            index={index}
            eyebrow={process.eyebrow}
            title={process.title}
            description={process.description}
          />
        </div>

        <ol className="relative grid gap-10 before:absolute before:inset-y-5 before:start-[1.1rem] before:w-px before:bg-line-strong">
          {process.steps.map((step, i) => (
            <Reveal as="li" key={`${i}-${step.hash}`} delay={i * 60} className="relative ps-16">
              <span
                aria-hidden="true"
                className="absolute start-0 top-0 grid size-9 place-items-center rounded-full border border-line-strong bg-canvas font-mono text-sm font-semibold text-ink-muted transition-colors duration-700 group-data-[visible=true]:border-transparent group-data-[visible=true]:bg-primary-500 group-data-[visible=true]:text-on-primary"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="flex flex-col items-start gap-y-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                <h3 className="text-xl font-bold">{step.title}</h3>
                <span dir="ltr" className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">
                  #{step.hash}
                </span>
              </div>
              <p className="mt-2 text-ink-muted">{step.text}</p>
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
                <Check aria-hidden="true" className="size-4 text-accent" strokeWidth={2.5} />
                <span className="text-ink-muted">{process.deliverableLabel}:</span>
                <strong className="font-semibold">{step.deliverable}</strong>
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}
