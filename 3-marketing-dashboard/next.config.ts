import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A fully dynamic local app: it reads the filesystem and SQLite on every request, so the static-shell
  // optimisations of Cache Components / partial prefetching only get in the way.
  cacheComponents: false,
  // The SDK ships a native Claude Code binary and must be loaded by Node, not bundled.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "exceljs"],
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
