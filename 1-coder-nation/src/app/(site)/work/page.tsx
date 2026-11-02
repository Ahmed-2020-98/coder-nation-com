import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { content } from "@/content";
import { Reveal } from "@/components/Reveal";
import { Footer } from "@/components/sections/Footer";
import { Navbar } from "@/components/sections/Navbar";
import { WorkCard } from "@/components/sections/Work";
import { Breadcrumb, CodeLabel, WorkCta, WorkHero, projectCount } from "@/components/work/WorkParts";
import { siteChrome } from "@/lib/site-chrome";
import { withSlugs } from "@/lib/work";
import { getSiteView } from "@/server/content";

const { workPage: t } = content;

export async function generateMetadata(): Promise<Metadata> {
  const { content: page } = await getSiteView();
  const title = `${page.work.eyebrow} | ${content.meta.siteName}`;
  const description = page.work.description || page.work.title;
  return {
    title,
    description,
    alternates: { canonical: "/work" },
    openGraph: { title, description, url: "/work", type: "website", siteName: content.meta.siteName, locale: "ar_EG" },
  };
}

/** Every project, each card leading to its own page. Off the site entirely while "أعمالنا" is switched off in the admin. */
export default async function WorkIndexPage() {
  const view = await getSiteView();
  if (view.hidden.includes("work")) notFound();
  const { work } = view.content;
  const items = withSlugs(work.items);
  const { nav, footer } = siteChrome(view, { inner: true });
  const labels = { placeholderBadge: work.placeholderBadge, caseLabel: work.caseLabel };

  return (
    <>
      <Navbar nav={nav} home="/" current="/work" />
      <main id="main">
        <WorkHero>
          <Breadcrumb trail={[{ label: t.home, href: "/" }, { label: work.eyebrow }]} />
          <div className="rise mt-10 max-w-3xl" style={{ "--d": "80ms" } as CSSProperties}>
            <p className="flex flex-wrap items-center gap-3">
              <CodeLabel>{work.eyebrow}</CodeLabel>
              <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
              <span className="text-sm text-ink-muted">{projectCount(items.length)}</span>
            </p>
            <h1 className="mt-4 text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.3] font-bold">{work.title}</h1>
            {work.description ? <p className="mt-5 max-w-2xl text-lg text-ink-muted">{work.description}</p> : null}
          </div>
        </WorkHero>

        <section data-tone="navy" aria-label={work.eyebrow} className="bg-canvas-alt pb-(--section-y) text-ink">
          <ul className="mx-auto grid w-full max-w-page gap-6 px-(--gutter) pt-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <Reveal as="li" key={item.href} delay={(i % 3) * 90}>
                <WorkCard item={item} index={i} labels={labels} />
              </Reveal>
            ))}
          </ul>
        </section>

        <WorkCta />
      </main>
      <Footer footer={footer} />
    </>
  );
}
