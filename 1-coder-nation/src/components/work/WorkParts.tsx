import type { ReactNode } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { content } from "@/content";
import { Button } from "@/components/ui/Button";

const { workPage: t } = content;

/** "6 مشاريع": the count in the form Arabic gives that number. */
export function projectCount(n: number): string {
  const form = n === 1 ? t.count.one : n === 2 ? t.count.two : n <= 10 ? t.count.few : t.count.many;
  return form.replace("{n}", String(n));
}

/** The navy band every /work page opens with: same atmosphere as the home hero, room for the fixed header. */
export function WorkHero({ children }: { children: ReactNode }) {
  return (
    <section id="top" data-tone="navy" className="relative isolate overflow-clip bg-canvas pt-[calc(var(--header-h)+3rem)] pb-14 text-ink sm:pb-20">
      <div aria-hidden="true" className="hero-bg absolute inset-0 -z-10" />
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10 opacity-70" />
      <div className="mx-auto w-full max-w-page px-(--gutter)">{children}</div>
    </section>
  );
}

/** الرئيسية / الأعمال / … — the last crumb is the current page (not a link). */
export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label={t.breadcrumb}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        {trail.map((crumb, index) => (
          <li key={crumb.label} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronLeft aria-hidden="true" className="size-3.5 opacity-60 ltr:rotate-180" /> : null}
            {crumb.href ? (
              <a href={crumb.href} className="inline-flex min-h-8 items-center rounded transition-colors hover:text-accent">
                {crumb.label}
              </a>
            ) : (
              <span aria-current="page" className="font-medium text-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** "// case study" and the like: the site's code-comment label, in its mono voice. */
export function CodeLabel({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" className="font-mono text-sm font-semibold text-accent">
      {"// "}
      {children}
    </span>
  );
}

/** The closing call to action of the /work pages: back to the contact form on the home page. */
export function WorkCta() {
  return (
    <section data-tone="navy" aria-labelledby="work-cta-title" className="relative isolate overflow-clip bg-canvas py-(--section-y) text-ink">
      <div aria-hidden="true" className="hero-bg absolute inset-0 -z-10 opacity-80" />
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10 opacity-50" />
      <div className="mx-auto flex w-full max-w-page flex-col items-start gap-6 px-(--gutter) md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <CodeLabel>next()</CodeLabel>
          <h2 id="work-cta-title" className="mt-3 text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.4] font-bold">
            {t.ctaTitle}
          </h2>
          <p className="mt-3 text-lg text-ink-muted">{t.ctaText}</p>
        </div>
        <Button href={t.ctaHref} size="lg">
          {t.ctaButton}
          <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-(--duration-base) group-hover:-translate-x-1 ltr:rotate-180" />
        </Button>
      </div>
    </section>
  );
}
