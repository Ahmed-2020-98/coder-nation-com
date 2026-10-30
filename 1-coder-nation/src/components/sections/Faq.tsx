import { content } from "@/content";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/Button";
import { ArrowIcon } from "@/components/icons";
import { Section, SectionHeader } from "@/components/ui/Section";
import { FaqList } from "./FaqList";

export function Faq() {
  const { faq } = content;

  return (
    <Section id="faq" tone="light" alt labelledBy="faq-title">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            id="faq-title"
            index={faq.index}
            eyebrow={faq.eyebrow}
            title={faq.title}
            description={faq.description}
          />

          <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-card">
            <p className="text-lg font-bold">{faq.helpTitle}</p>
            <p className="mt-1.5 text-ink-muted">{faq.helpText}</p>
            <Button href={faq.helpCta.href} className="mt-5">
              {faq.helpCta.label}
              <ArrowIcon />
            </Button>
          </div>
        </div>

        <Reveal>
          <FaqList items={faq.items} />
        </Reveal>
      </div>
    </Section>
  );
}
