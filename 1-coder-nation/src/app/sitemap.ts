import type { MetadataRoute } from "next";
import { isPublishable, withSlugs } from "@/lib/work";
import { getSiteView } from "@/server/content";
import { siteUrl } from "@/server/env";

// The home page, the list of projects and each real project's page (samples are placeholder text, never listed).
// Nothing under /work while "أعمالنا" is switched off in the admin. No lastModified: the content has no dates.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { content, hidden } = await getSiteView();
  const pages: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "monthly", priority: 1 }];
  if (hidden.includes("work")) return pages;
  pages.push({ url: `${base}/work`, changeFrequency: "monthly", priority: 0.8 });
  for (const item of withSlugs(content.work.items)) {
    if (isPublishable(item)) pages.push({ url: `${base}${item.href}`, changeFrequency: "yearly", priority: 0.6 });
  }
  return pages;
}
