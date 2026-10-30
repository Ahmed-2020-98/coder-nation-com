import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/env";

// One page for now (the sections are anchors on it). No lastModified: the content is a deploy, not a database row.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: "monthly", priority: 1 }];
}
