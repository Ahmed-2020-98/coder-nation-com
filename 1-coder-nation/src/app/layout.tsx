import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Noto_Kufi_Arabic } from "next/font/google";
import { content } from "@/content";
import "./globals.css";

// Headings: geometric Kufi gives the page a technical, distinctive voice.
const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-kufi",
  display: "swap",
});

// Body: highly readable Arabic with a "tech" skeleton (same family as the Latin IBM Plex).
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

// Code / small technical labels.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: content.meta.title,
  description: content.meta.description,
  applicationName: content.meta.siteName,
  openGraph: {
    title: content.meta.title,
    description: content.meta.description,
    siteName: content.meta.siteName,
    type: "website",
    locale: "ar_AR",
  },
};

// Keep in sync with --color-secondary-900 in src/styles/tokens.css
export const viewport: Viewport = {
  themeColor: "#0B1B3A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={content.meta.lang}
      dir={content.meta.dir}
      className={`${kufi.variable} ${plex.variable} ${mono.variable}`}
    >
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
