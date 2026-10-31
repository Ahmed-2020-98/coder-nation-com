import { content, type SiteContent } from "@/content";
import { whatsappUrl } from "@/config/site";
import { getSiteSettings } from "@/server/settings";
import { contactRows } from "@/server/site-links";
import { DynamicIcon, WhatsAppIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/Button";
import { Section, SectionHeader } from "@/components/ui/Section";
import { ContactForm } from "./ContactForm";

export async function Contact({ data: contact, index }: { data: SiteContent["contact"]; index: string }) {
  const { a11y } = content;
  const settings = await getSiteSettings();

  return (
    <Section id="contact" tone="navy" labelledBy="contact-title">
      <div aria-hidden="true" className="hero-bg absolute inset-0 -z-10 opacity-70" />
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10 opacity-60" />

      <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeader
            id="contact-title"
            index={index}
            eyebrow={contact.eyebrow}
            title={contact.title}
            description={contact.description}
          />

          <p className="mt-8 text-sm text-secondary-300">
            <span dir="ltr" className="me-2 font-mono text-accent">
              {"//"}
            </span>
            {contact.codeComment}
          </p>

          <Button
            href={whatsappUrl(settings.whatsappNumber, contact.whatsapp.message)}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="lg"
            className="mt-5"
          >
            <WhatsAppIcon className="size-5 text-success-300" />
            {contact.whatsapp.label}
            <span className="sr-only">{a11y.newTab}</span>
          </Button>

          <ul className="mt-10 grid gap-5">
            {contactRows(settings).map((row) => (
              <li key={row.label} className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <DynamicIcon name={row.icon} className="size-5" />
                </span>
                <span>
                  <span className="block text-sm text-ink-muted">{row.label}</span>
                  <span className="block font-semibold">{row.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Reveal>
          <ContactForm whatsappHref={whatsappUrl(settings.whatsappNumber, contact.whatsapp.message)} />
        </Reveal>
      </div>
    </Section>
  );
}
