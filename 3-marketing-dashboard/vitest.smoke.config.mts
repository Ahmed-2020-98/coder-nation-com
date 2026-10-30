import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts on purpose: these tests call the REAL Claude API and cost money, so
// `npm test` must never pick them up. Run them with `npm run smoke:agents`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.smoke.ts"],
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 60 * 1000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
