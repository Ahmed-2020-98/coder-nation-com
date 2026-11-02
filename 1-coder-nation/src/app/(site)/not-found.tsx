import type { Metadata } from "next";
import Link from "next/link";
import { content } from "@/content";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: `${content.notFound.title} | ${content.meta.siteName}`, robots: { index: false } };

/** Any address on the public site that does not exist, including a project that was removed or renamed. */
export default function NotFound() {
  const t = content.notFound;
  return (
    <main id="main" data-tone="navy" className="relative isolate grid min-h-svh place-items-center overflow-clip bg-canvas px-(--gutter) py-20 text-ink">
      <div aria-hidden="true" className="hero-bg absolute inset-0 -z-10" />
      <div aria-hidden="true" className="dot-grid absolute inset-0 -z-10 opacity-70" />
      <div className="rise max-w-xl text-center">
        <Link href="/" aria-label={content.a11y.home} className="inline-block rounded-lg">
          <Logo />
        </Link>
        <p dir="ltr" className="mt-10 font-mono text-sm font-semibold text-accent">
          {"// 404"}
        </p>
        <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.4] font-bold">{t.title}</h1>
        <p className="mt-4 text-lg text-ink-muted">{t.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" size="lg">
            {t.home}
          </Button>
          <Button href="/work" variant="secondary" size="lg">
            {t.work}
          </Button>
        </div>
      </div>
    </main>
  );
}
