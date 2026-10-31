import type { CSSProperties } from "react";
import type { SiteContent } from "@/content";
import { ArrowIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { HeroVisual } from "./HeroVisual";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** `hidden` = the sections that are not on the page: a button that points at one of them is left out. */
export function Hero({ hero, showSecondary }: { hero: SiteContent["hero"]; showSecondary: boolean }) {

  return (
    <section
      id="top"
      data-tone="navy"
      aria-labelledby="hero-title"
      className="relative isolate overflow-clip bg-canvas pt-[calc(var(--header-h)+clamp(2.5rem,6vw,5rem))] pb-[clamp(4.5rem,9vw,8rem)] text-ink"
    >
      <div aria-hidden="true" className="hero-bg absolute inset-0 -z-10" />
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10" />
      <div aria-hidden="true" className="grain absolute inset-0 -z-10" />

      <div className="mx-auto grid w-full max-w-page items-center gap-16 px-(--gutter) lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          <p
            className="rise inline-flex items-center gap-2.5 rounded-full border border-line bg-white/5 px-4 py-1.5 text-sm text-ink-muted"
            style={delay(0)}
          >
            <span className="pulse-dot" aria-hidden="true" />
            {hero.badge}
          </p>

          <h1
            id="hero-title"
            className="rise mt-6 text-[clamp(2.15rem,4.9vw,3.9rem)] leading-[1.3] font-extrabold"
            style={delay(120)}
          >
            {hero.titleLead}{" "}
            <span className="relative inline-block text-primary-500">
              {hero.titleHighlight}
              <svg
                aria-hidden="true"
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
                className="absolute inset-x-0 -bottom-2.5 h-3 w-full text-primary-500"
                fill="none"
              >
                <path
                  d="M3 9c40-8 80-8 110-3s70 4 104-2"
                  pathLength={1}
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="draw"
                />
              </svg>
            </span>
          </h1>

          <p className="rise mt-7 max-w-[34rem] text-[1.125rem] text-ink-muted" style={delay(260)}>
            {hero.description}
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={delay(380)}>
            <Button href={hero.primaryCta.href} size="lg">
              {hero.primaryCta.label}
              <ArrowIcon className="size-4 transition-transform duration-(--duration-base) group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Button>
            {showSecondary ? (
              <Button href={hero.secondaryCta.href} variant="secondary" size="lg">
                {hero.secondaryCta.label}
              </Button>
            ) : null}
          </div>

          <div className="rise mt-12" style={delay(500)}>
            <p className="text-sm text-ink-muted">{hero.stackLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-2" dir="ltr">
              {hero.stack.map((tech) => (
                <li
                  key={tech}
                  className="rounded-md border border-line bg-white/5 px-3 py-1 font-mono text-xs leading-6 text-secondary-100"
                >
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
