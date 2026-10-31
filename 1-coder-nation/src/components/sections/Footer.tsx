import { ArrowUp } from "lucide-react";
import { content, type SiteContent } from "@/content";
import { ecosystem } from "@/config/ecosystem";
import { Logo } from "@/components/Logo";
import { getSiteSettings, SOCIAL_KEYS } from "@/server/settings";
import { contactRows } from "@/server/site-links";

// Cache Components forbids reading the clock during prerender; "use cache" resolves it once and reuses it.
async function CurrentYear() {
  "use cache";
  return new Date().getFullYear();
}

/** `footer.columns` arrive already without the links to sections that are not on the page. */
export async function Footer({ footer }: { footer: SiteContent["footer"] }) {
  const settings = await getSiteSettings();
  // Only the links switched on in the admin panel (default: src/config/ecosystem.ts, none yet) are shown.
  const apps = ecosystem.filter((app) => settings.ecosystem[app.id]);
  const socials = SOCIAL_KEYS.filter((key) => settings.socials[key]);

  return (
    <footer data-tone="navy" className="relative border-t border-line bg-canvas-alt text-ink">
      <div className="mx-auto w-full max-w-page px-(--gutter) pt-16 pb-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-ink-muted">{footer.description}</p>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="font-heading font-bold">{column.title}</p>
              <ul className="mt-4 grid gap-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex min-h-9 items-center text-ink-muted transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <p className="font-heading font-bold">{footer.contactTitle}</p>
            <ul className="mt-4 grid gap-3 text-ink-muted">
              {contactRows(settings).map((row) => (
                <li key={row.label}>
                  <span className="block text-sm">{row.label}</span>
                  <span className="block text-ink">{row.value}</span>
                </li>
              ))}
            </ul>

            {socials.length > 0 ? (
              <>
                <p className="mt-8 font-heading font-bold">{footer.socialTitle}</p>
                <ul className="mt-3 grid gap-1">
                  {socials.map((key) => (
                    <li key={key}>
                      <a
                        href={settings.socials[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="inline-flex min-h-9 items-center text-ink-muted transition-colors hover:text-accent"
                      >
                        {footer.socialLabels[key]}
                        <span className="sr-only">{content.a11y.newTab}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {apps.length > 0 ? (
              <>
                <p className="mt-8 font-heading font-bold">{footer.ecosystemTitle}</p>
                <ul className="mt-3 grid gap-1">
                  {apps.map((app) => (
                    <li key={app.id}>
                      <a
                        href={app.href}
                        className="inline-flex min-h-9 items-center text-ink-muted transition-colors hover:text-accent"
                      >
                        {footer.ecosystemLabels[app.id]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-ink-muted">
          <p>
            © <CurrentYear /> {content.meta.siteName}. {footer.rights}
          </p>
          <a
            href="#top"
            className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-accent"
          >
            {footer.backToTop}
            <ArrowUp aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
