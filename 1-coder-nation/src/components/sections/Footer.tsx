import { ArrowUp } from "lucide-react";
import { content } from "@/content";
import { ecosystem } from "@/config/ecosystem";
import { Logo } from "@/components/Logo";

// Cache Components forbids reading the clock during prerender; "use cache" resolves it once and reuses it.
async function CurrentYear() {
  "use cache";
  return new Date().getFullYear();
}

export function Footer() {
  const { footer, contact } = content;
  // Only links flagged `enabled` in src/config/ecosystem.ts are shown (none yet).
  const apps = ecosystem.filter((app) => app.enabled);

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
              {contact.info.map((row) => (
                <li key={row.label}>
                  <span className="block text-sm">{row.label}</span>
                  <span className="block text-ink">{row.value}</span>
                </li>
              ))}
            </ul>

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
