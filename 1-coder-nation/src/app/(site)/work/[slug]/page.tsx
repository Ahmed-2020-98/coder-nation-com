import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";
import { content } from "@/content";
import type { SiteView } from "@/lib/content-model";
import { siteChrome } from "@/lib/site-chrome";
import { findWork, isPublishable, withSlugs, type SluggedWork } from "@/lib/work";
import { PlainText } from "@/components/PlainText";
import { Reveal } from "@/components/Reveal";
import { WorkCover } from "@/components/WorkArt";
import { Footer } from "@/components/sections/Footer";
import { Navbar } from "@/components/sections/Navbar";
import { Breadcrumb, CodeLabel, WorkCta, WorkHero } from "@/components/work/WorkParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { siteUrl } from "@/server/env";
import { getSiteView } from "@/server/content";

const { workPage: t } = content;

/** The projects known at build time are prerendered; one added later from the admin is rendered on its first visit. */
export async function generateStaticParams() {
  const { content: page } = await getSiteView();
  const slugs = withSlugs(page.work.items).map((item) => ({ slug: item.slugValue }));
  // At least one entry is required; an unknown one simply renders the "not found" page.
  return slugs.length > 0 ? slugs : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const [{ slug }, view] = await Promise.all([params, getSiteView()]);
  const found = view.hidden.includes("work") ? null : findWork(view.content.work.items, slug);
  if (!found) return { title: content.meta.siteName, robots: { index: false } };
  const { item } = found;
  const title = `${item.title} | ${content.meta.siteName}`;
  return {
    title,
    description: item.text,
    alternates: { canonical: item.href },
    // A sample project is placeholder text: never in search results.
    robots: isPublishable(item) ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description: item.text,
      url: item.href,
      type: "article",
      siteName: content.meta.siteName,
      locale: "ar_EG",
      images: item.image ? [{ url: `/media/${item.image}`, alt: item.title }] : undefined,
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const view = await getSiteView();
  if (view.hidden.includes("work")) notFound();
  const { nav, footer } = siteChrome(view, { inner: true });
  return (
    <>
      <Navbar nav={nav} home="/" current="/work" />
      <main id="main">
        {/* The project is read inside the boundary, so a project added after the build still gets an instant shell. */}
        <Suspense fallback={<CaseStudyFallback />}>
          <CaseStudy params={params} view={view} />
        </Suspense>
        <WorkCta />
      </main>
      <Footer footer={footer} />
    </>
  );
}

function CaseStudyFallback() {
  return (
    <WorkHero>
      <div className="h-[28rem] animate-pulse rounded-2xl bg-white/5" />
    </WorkHero>
  );
}

async function CaseStudy({ params, view }: { params: PageProps<"/work/[slug]">["params"]; view: SiteView }) {
  const { slug } = await params;
  const { work } = view.content;
  const found = findWork(work.items, slug);
  if (!found) notFound();
  const { item, index, prev, next } = found;

  const facts = (
    [
      [t.client, item.client],
      [t.category, item.category],
      [t.year, item.year],
      [t.duration, item.duration],
    ] as const
  ).filter(([, value]) => value);
  const gallery = item.gallery.filter((shot) => shot.image);

  return (
    <>
      <CaseStudyJsonLd item={item} />
      <WorkHero>
        <Breadcrumb trail={[{ label: t.home, href: "/" }, { label: work.eyebrow, href: "/work" }, { label: item.title }]} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-end">
          <div className="rise" style={{ "--d": "80ms" } as CSSProperties}>
            <p className="flex flex-wrap items-center gap-3">
              <CodeLabel>{t.caseStudy}</CodeLabel>
              <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
              <Badge tone="accent">{item.category}</Badge>
              {item.sample ? <Badge>{work.placeholderBadge}</Badge> : null}
            </p>
            <h1 className="mt-5 text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.3] font-bold">{item.title}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">{item.text}</p>
            {item.link ? (
              <Button href={item.link} target="_blank" rel="noopener noreferrer" className="mt-8">
                {work.visitLabel}
                <ExternalLink aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                <span className="sr-only">{content.a11y.newTab}</span>
              </Button>
            ) : null}
          </div>

          <div className="rise relative aspect-[16/11] overflow-hidden rounded-2xl border border-line shadow-lift" style={{ "--d": "220ms" } as CSSProperties}>
            <WorkCover art={item.art} image={item.image} title={item.title} index={index} zoom={false} eager />
          </div>
        </div>
      </WorkHero>

      <section data-tone="light" aria-label={t.spec} className="relative isolate bg-canvas py-(--section-y) text-ink">
        <div aria-hidden="true" className="blueprint absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-page gap-12 px-(--gutter) lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="grid content-start gap-12">
            {item.challenge ? (
              <Reveal as="section" className="max-w-3xl">
                <h2 className="text-2xl font-bold">
                  <CodeLabel>01</CodeLabel> <span className="ms-2">{t.challenge}</span>
                </h2>
                <div className="mt-4 text-[1.05rem] text-ink-muted">
                  <PlainText text={item.challenge} />
                </div>
              </Reveal>
            ) : null}
            {item.solution ? (
              <Reveal as="section" className="max-w-3xl">
                <h2 className="text-2xl font-bold">
                  <CodeLabel>{item.challenge ? "02" : "01"}</CodeLabel> <span className="ms-2">{t.solution}</span>
                </h2>
                <div className="mt-4 text-[1.05rem] text-ink-muted">
                  <PlainText text={item.solution} />
                </div>
              </Reveal>
            ) : null}
            {item.results.length > 0 ? (
              <Reveal as="section">
                <h2 className="text-2xl font-bold">{t.results}</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {item.results.map((result) => (
                    <li key={result} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
                      <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                        <Check className="size-4" />
                      </span>
                      <span className="font-medium">{result}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </div>

          <aside aria-label={t.spec} className="max-lg:order-first lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
            <div data-tone="navy" className="overflow-hidden rounded-xl border border-line bg-canvas text-ink shadow-lift">
              <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                {[0, 1, 2].map((n) => (
                  <span key={n} aria-hidden="true" className={n === 2 ? "size-2.5 rounded-full bg-primary-500" : "size-2.5 rounded-full bg-secondary-600"} />
                ))}
                <span dir="ltr" className="ms-3 font-mono text-xs text-ink-muted">
                  {t.specFile}
                </span>
              </div>
              <div className="grid gap-4 p-5">
                <h2 className="text-sm font-semibold text-ink-muted">{t.spec}</h2>
                {facts.length > 0 ? (
                  <dl className="grid gap-3">
                    {facts.map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[6rem_1fr] items-baseline gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                        <dt className="font-mono text-xs text-accent">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {item.tags.length > 0 ? (
                  <div>
                    <p className="font-mono text-xs text-accent">{t.stack}</p>
                    <ul className="mt-2 flex flex-wrap gap-2" dir="ltr">
                      {item.tags.map((tag) => (
                        <li key={tag}>
                          <Badge mono>{tag}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.link ? (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex min-h-10 items-center gap-2 truncate font-mono text-sm text-accent hover:underline">
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                    {item.link.replace(/^https:\/\//, "")}
                    <span className="sr-only">{content.a11y.newTab}</span>
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {gallery.length > 0 ? (
        <section data-tone="light" aria-labelledby="gallery-title" className="bg-canvas-alt py-(--section-y) text-ink">
          <div className="mx-auto w-full max-w-page px-(--gutter)">
            <h2 id="gallery-title" className="text-2xl font-bold">
              {t.gallery}
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {gallery.map((shot, i) => (
                <Reveal as="li" key={`${i}-${shot.image}`} delay={(i % 2) * 90} className={i === 0 && gallery.length > 1 && gallery.length % 2 === 1 ? "sm:col-span-2" : undefined}>
                  <figure className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by our own /media route */}
                    <img src={`/media/${shot.image}`} alt={shot.caption || item.title} loading="lazy" decoding="async" className="w-full object-cover" />
                    {shot.caption ? <figcaption className="px-4 py-3 text-sm text-ink-muted">{shot.caption}</figcaption> : null}
                  </figure>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {prev || next ? (
        <nav aria-label={t.others} data-tone="navy" className="border-y border-line bg-canvas-alt text-ink">
          <div className="mx-auto grid w-full max-w-page sm:grid-cols-2">
            <Neighbour item={prev} label={t.prev} side="prev" />
            <Neighbour item={next} label={t.next} side="next" />
          </div>
        </nav>
      ) : null}
    </>
  );
}

/** The previous / next project: a big link with its title. "Next" sits on the reading end (left in Arabic). */
function Neighbour({ item, label, side }: { item: SluggedWork | null; label: string; side: "prev" | "next" }) {
  if (!item) return <div aria-hidden="true" className="hidden sm:block" />;
  const Arrow = side === "next" ? ArrowLeft : ArrowRight;
  return (
    <a
      href={item.href}
      rel={side}
      className={`group flex min-h-32 flex-col justify-center gap-2 px-(--gutter) py-8 transition-colors hover:bg-white/5 ${side === "next" ? "sm:items-end sm:border-s sm:border-line sm:text-end" : ""}`}
    >
      <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
        {side === "prev" ? <Arrow aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1 ltr:rotate-180" /> : null}
        {label}
        {side === "next" ? <Arrow aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-1 ltr:rotate-180" /> : null}
      </span>
      <span className="text-xl font-bold group-hover:text-accent">{item.title}</span>
    </a>
  );
}

/** schema.org CreativeWork + the breadcrumb trail, for search engines. Only for real projects. */
function CaseStudyJsonLd({ item }: { item: SluggedWork }) {
  if (!isPublishable(item)) return null;
  const base = siteUrl();
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: item.title,
      description: item.text,
      url: `${base}${item.href}`,
      genre: item.category,
      ...(item.year ? { dateCreated: item.year } : {}),
      ...(item.image ? { image: `${base}/media/${item.image}` } : {}),
      creator: { "@type": "Organization", name: content.meta.siteName, url: base },
      keywords: item.tags.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.home, item: `${base}/` },
        { "@type": "ListItem", position: 2, name: content.work.eyebrow, item: `${base}/work` },
        { "@type": "ListItem", position: 3, name: item.title, item: `${base}${item.href}` },
      ],
    },
  ];
  // `<` is escaped so a value containing "</script>" can never close the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
