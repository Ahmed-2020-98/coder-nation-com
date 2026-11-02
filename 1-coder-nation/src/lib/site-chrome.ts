// The menu and the footer every public page shows, built from the same page content: links to sections that are not
// on the home page are dropped (see visibleLinks). On an inner page (/work...) a "#section" link must lead back to
// that section of the home page, so it becomes "/#section"; "#work" leads to the full list of projects instead.
import type { SiteContent } from "@/content";
import { visibleLinks, type SiteView } from "./content-model";

export function linkFromInnerPage(href: string): string {
  if (href === "#work") return "/work";
  return href.startsWith("#") ? `/${href}` : href;
}

const relink = <T extends { href: string }>(link: T, inner: boolean): T => (inner ? { ...link, href: linkFromInnerPage(link.href) } : link);

export function siteChrome(view: SiteView, { inner = false }: { inner?: boolean } = {}): { nav: SiteContent["nav"]; footer: SiteContent["footer"] } {
  const { content, hidden } = view;
  return {
    nav: {
      ...content.nav,
      links: visibleLinks(content.nav.links, hidden).map((link) => relink(link, inner)),
      cta: relink(content.nav.cta, inner),
    },
    footer: {
      ...content.footer,
      columns: content.footer.columns.map((column) => ({ ...column, links: visibleLinks(column.links, hidden).map((link) => relink(link, inner)) })),
    },
  };
}
