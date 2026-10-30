import { content } from "@/content";
import { siteUrl } from "@/server/env";
import { getSiteSettings, SOCIAL_KEYS } from "@/server/settings";

/** schema.org Organization for search engines: built from the same settings the page shows. */
export async function OrganizationJsonLd() {
  const settings = await getSiteSettings();
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: content.meta.siteName,
    url: siteUrl(),
    email: settings.email,
    description: settings.seo.description,
    sameAs: SOCIAL_KEYS.map((key) => settings.socials[key]).filter(Boolean),
  };
  // `<` is escaped so a value containing "</script>" can never close the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
