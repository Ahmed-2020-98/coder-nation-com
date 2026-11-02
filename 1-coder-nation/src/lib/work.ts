// The projects of "أعمالنا" as pages: each one's address (/work/<slug>), finding one by it, and which may be shown to
// search engines. Pure functions, safe in browser code.
import type { WorkItem } from "@/content/ar";

export type SluggedWork = WorkItem & { href: string; slugValue: string };

/**
 * A URL-safe name made from the title when the admin left the slug empty: letters (Arabic or Latin) and digits kept,
 * everything else becomes one "-". "متجر النور 2" -> "متجر-النور-2". Empty only for a title with no letters at all.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics and tatweel: "مشروع" and "مَشْروع" are the same page
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Every project with its address. Two that would share one get "-2", "-3" ... in list order, so links never collide. */
export function withSlugs(items: readonly WorkItem[]): SluggedWork[] {
  const used = new Set<string>();
  return items.map((item, index) => {
    const base = item.slug || slugify(item.title) || `project-${index + 1}`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return { ...item, slugValue: slug, href: `/work/${encodeURIComponent(slug)}` };
  });
}

/** The project at /work/<slug> (the route hands the segment over still percent-encoded) and its neighbours, or null. */
export function findWork(items: readonly WorkItem[], rawSlug: string): { item: SluggedWork; index: number; prev: SluggedWork | null; next: SluggedWork | null } | null {
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return null;
  }
  const all = withSlugs(items);
  const index = all.findIndex((item) => item.slugValue === slug);
  if (index === -1) return null;
  return { item: all[index], index, prev: all[index - 1] ?? null, next: all[index + 1] ?? null };
}

/** A real project (not a sample) is listed in the sitemap and may be indexed. */
export const isPublishable = (item: Pick<WorkItem, "sample">): boolean => !item.sample;
