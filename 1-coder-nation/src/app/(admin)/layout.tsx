import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/admin/ui/Toaster";
import { fontVariables } from "../fonts";
import "../globals.css";
import "./admin.css";

// A second root layout: the panel shares the site's fonts and design tokens but none of its page chrome.
export const metadata: Metadata = {
  title: { default: "لوحة التحكم | Coder Nation", template: "%s | لوحة التحكم" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#0B1B3A" };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={fontVariables}>
      <body data-tone="light" className="min-h-svh">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
