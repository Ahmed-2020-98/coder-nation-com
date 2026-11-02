import { ArrowLeft } from "lucide-react";
import type { SiteContent } from "@/content";
import { cn } from "@/lib/cn";
import { withSlugs, type SluggedWork } from "@/lib/work";
import { Reveal } from "@/components/Reveal";
import { WorkCover } from "@/components/WorkArt";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Section, SectionHeader } from "@/components/ui/Section";

/** How many projects the home page shows; the rest are on /work. */
const ON_HOME = 6;

type Labels = Pick<SiteContent["work"], "placeholderBadge" | "caseLabel">;

/** The sample badge sits on the cover, so it reads the same on a picture and on a drawing. */
function SampleBadge({ label }: { label: string }) {
  return (
    <span className="absolute start-3 top-3 z-10 rounded-full border border-white/25 bg-black/30 px-3 py-0.5 text-xs leading-6 font-medium text-white backdrop-blur">
      {label}
    </span>
  );
}

function CaseLink({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
      {label}
      <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-(--duration-base) ease-(--ease-out-expo) group-hover/card:-translate-x-1 ltr:rotate-180 ltr:group-hover/card:translate-x-1" />
    </span>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" dir="ltr">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge mono>{tag}</Badge>
        </li>
      ))}
    </ul>
  );
}

const cardFrame =
  "group/card flex h-full overflow-hidden rounded-xl border border-line bg-surface outline-offset-4 transition-[transform,border-color,box-shadow] duration-(--duration-base) ease-(--ease-out-expo) hover:-translate-y-1 hover:border-accent hover:shadow-glow focus-visible:border-accent";

/** A project card: the whole card is one link to the project's page. */
export function WorkCard({ item, index, labels, wide = false }: { item: SluggedWork; index: number; labels: Labels; wide?: boolean }) {
  return (
    <a href={item.href} className={cn(cardFrame, "flex-col")}>
      <div className={cn("relative aspect-[4/3]", wide && "lg:aspect-[16/8]")}>
        {item.sample ? <SampleBadge label={labels.placeholderBadge} /> : null}
        <WorkCover art={item.art} image={item.image} title={item.title} index={index} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <Badge tone="accent" className="w-fit">
          {item.category}
        </Badge>
        <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
        <p className="mt-1.5 text-[0.95rem] text-ink-muted">{item.text}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <Tags tags={item.tags} />
          <CaseLink label={labels.caseLabel} />
        </div>
      </div>
    </a>
  );
}

/** A project across the whole grid, its big cover beside its story: the first one, and a last one left alone in its row. */
function FeaturedCard({ item, labels, index = 0 }: { item: SluggedWork; labels: Labels; index?: number }) {
  return (
    <a href={item.href} className={cn(cardFrame, "flex-col lg:flex-row")}>
      <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[24rem] lg:w-[58%]">
        {item.sample ? <SampleBadge label={labels.placeholderBadge} /> : null}
        <WorkCover art={item.art} image={item.image} title={item.title} index={index} />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-4 p-7 lg:p-10">
        <p className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">{item.category}</Badge>
          {item.client || item.year ? (
            <span className="text-sm text-ink-muted">
              {[item.client, item.year].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </p>
        <h3 className="text-[clamp(1.4rem,2.4vw,1.9rem)] leading-snug font-bold">{item.title}</h3>
        <p className="text-ink-muted">{item.text}</p>
        <Tags tags={item.tags} />
        <div className="pt-2">
          <CaseLink label={labels.caseLabel} />
        </div>
      </div>
    </a>
  );
}

export function Work({ data: work, index }: { data: SiteContent["work"]; index: string }) {
  const items = withSlugs(work.items);
  const [featured, ...rest] = items.slice(0, ON_HOME);
  const labels = { placeholderBadge: work.placeholderBadge, caseLabel: work.caseLabel };

  return (
    <Section id="work" tone="navy" labelledBy="work-title">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeader id="work-title" index={index} eyebrow={work.eyebrow} title={work.title} description={work.description} />
        <Button href="/work" variant="secondary" className="max-sm:hidden">
          {work.allLabel}
          <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
        </Button>
      </div>

      {/* Six columns on wide screens: three cards a row, and when two are left over they share the last row. */}
      <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        {featured ? (
          <Reveal as="li" className="sm:col-span-2 lg:col-span-6">
            <FeaturedCard item={featured} labels={labels} />
          </Reveal>
        ) : null}
        {rest.map((item, i) => {
          // A single project left over gets the full-width layout instead of one card beside an empty row.
          if (rest.length % 3 === 1 && i === rest.length - 1) {
            return (
              <Reveal as="li" key={item.href} className="sm:col-span-2 lg:col-span-6">
                <FeaturedCard item={item} labels={labels} index={i + 1} />
              </Reveal>
            );
          }
          const wide = rest.length % 3 === 2 && i >= rest.length - 2;
          return (
            <Reveal as="li" key={item.href} delay={(i % 3) * 90} className={wide ? "lg:col-span-3" : "lg:col-span-2"}>
              <WorkCard item={item} index={i + 1} labels={labels} wide={wide} />
            </Reveal>
          );
        })}
      </ul>

      <div className="mt-10 flex justify-center sm:hidden">
        <Button href="/work" variant="secondary" size="lg" className="w-full">
          {work.allLabel}
          <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
        </Button>
      </div>
    </Section>
  );
}
