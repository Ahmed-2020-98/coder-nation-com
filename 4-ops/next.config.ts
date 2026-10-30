import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An internal app where nearly every page is per-user and live: no static shells, nothing cached across users.
  cacheComponents: false,
  poweredByHeader: false,
  // Server-only libraries, loaded from node_modules and never bundled.
  serverExternalPackages: ["postgres", "puppeteer-core", "@sparticuz/chromium"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  turbopack: {
    // Pin the workspace root: a stray package-lock.json in the home folder otherwise confuses root detection.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
