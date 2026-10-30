import { Quote, User } from "lucide-react";
import { content } from "@/content";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

export function Testimonials() {
  const { testimonials } = content;

  return (
    <Section id="testimonials" tone="light" labelledBy="testimonials-title">
      <SectionHeader
        id="testimonials-title"
        index={testimonials.index}
        eyebrow={testimonials.eyebrow}
        title={testimonials.title}
        description={testimonials.description}
      />

      <ul className="mt-14 grid gap-6 lg:grid-cols-3">
        {testimonials.items.map((item, i) => (
          // The middle card sits lower on desktop to break the straight row
          <Reveal as="li" key={i} delay={i * 100} className={cn(i === 1 && "lg:mt-10")}>
            <figure className="flex h-full flex-col rounded-xl border border-line bg-surface p-7 shadow-card">
              <span className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent">
                <Quote aria-hidden="true" className="size-5" />
              </span>
              <blockquote className="mt-5 flex-1 text-[1.05rem] leading-8 text-ink">{item.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary-100 text-secondary-600">
                  <User aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{item.name}</span>
                  <span className="block text-sm text-ink-muted">{item.role}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
