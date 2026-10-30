import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Noto_Kufi_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

// Same three fonts as the public site: Kufi for headings, Plex for text, JetBrains Mono for slugs and timings.
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], variable: "--font-kufi", display: "swap" });
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jb-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Marketing Dashboard | Coder Nation",
  description: "لوحة تشغيل الـ Marketing Agent: Research وScript وMontage وPosting لمحتوى TikTok.",
  robots: { index: false, follow: false },
};

// Keep in sync with --color-secondary-900 in src/styles/tokens.css
export const viewport: Viewport = { themeColor: "#0B1B3A" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${kufi.variable} ${plex.variable} ${mono.variable}`}>
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
