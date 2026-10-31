import { Check } from "lucide-react";
import type { SiteContent } from "@/content";
import { cn } from "@/lib/cn";
import { ArrowIcon, DynamicIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

// Asymmetric bento: wide / narrow, then narrow / wide, repeating for however many services there are.
const spans = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-5", "lg:col-span-7"];

export function Services({ data: services, index }: { data: SiteContent["services"]; index: string }) {

  return (
    <Section id="services" tone="light" labelledBy="services-title">
      <div aria-hidden="true" className="blueprint absolute inset-x-0 top-0 -z-10 h-[34rem]" />

      <SectionHeader
        id="services-title"
        index={index}
        eyebrow={services.eyebrow}
        title={services.title}
        description={services.description}
      />

      <ul className="mt-14 grid gap-5 lg:grid-cols-12">
        {services.items.map((item, i) => {
          const featured = i === 0;
          return (
            <Reveal as="li" key={`${i}-${item.title}`} delay={i * 90} className={spans[i % spans.length]}>
              {/* The featured card flips to the navy tokens locally, so the same classes work on both tones */}
              <article
                data-tone={featured ? "navy" : undefined}
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-xl border p-7 text-ink sm:p-8",
                  "transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-(--ease-out-expo)",
                  "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:origin-left before:scale-x-0 before:bg-primary-500 before:transition-transform before:duration-500 rtl:before:origin-right",
                  "hover:-translate-y-1 hover:border-accent hover:shadow-lift hover:before:scale-x-100",
                  featured ? "border-line bg-canvas" : "border-line bg-surface shadow-card",
                )}
              >
                {featured ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full bg-primary-500/20 blur-3xl"
                    />
                    <span
                      aria-hidden="true"
                      dir="ltr"
                      className="pointer-events-none absolute -bottom-8 -end-3 font-mono text-[9rem] leading-none font-bold text-white/[0.045] select-none"
                    >
                      {"</>"}
                    </span>
                  </>
                ) : null}

                <header className="relative flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-lg bg-accent-soft text-accent">
                    <DynamicIcon name={item.icon} className="size-6" />
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-ink-muted"
                  >
                    {item.file}
                  </span>
                </header>

                <h3 className="relative mt-6 text-xl font-bold">{item.title}</h3>
                <p className="relative mt-3 text-ink-muted">{item.description}</p>

                <ul className="relative mt-6 grid gap-2.5 text-[0.95rem]">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check aria-hidden="true" className="mt-[0.45rem] size-4 shrink-0 text-accent" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className="group/link relative mt-auto inline-flex w-fit items-center gap-2 pt-8 font-semibold text-accent"
                >
                  {services.cardCta}
                  <ArrowIcon className="size-4 transition-transform duration-(--duration-base) group-hover/link:translate-x-1 rtl:group-hover/link:-translate-x-1" />
                </a>
              </article>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
