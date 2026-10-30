import type { Metadata, Viewport } from "next";
import { content } from "@/content";
import { siteUrl } from "@/server/env";
import { getSiteSettings } from "@/server/settings";
import { fontVariables } from "../fonts";
import "../globals.css";

// Title/description come from the admin panel's settings (cached, refreshed when they are saved).
export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: seo.title,
    description: seo.description,
    applicationName: content.meta.siteName,
    alternates: { canonical: "/" },
    openGraph: {
      title: seo.title,
      description: seo.description,
      siteName: content.meta.siteName,
      type: "website",
      locale: "ar_EG",
      url: "/",
    },
    twitter: { card: "summary", title: seo.title, description: seo.description },
  };
}

// Keep in sync with --color-secondary-900 in src/styles/tokens.css
export const viewport: Viewport = {
  themeColor: "#0B1B3A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={content.meta.lang} dir={content.meta.dir} className={fontVariables}>
      <body>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <a className="skip-link" href="#main">
          {content.a11y.skip}
        </a>
        <div className="scroll-progress" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
