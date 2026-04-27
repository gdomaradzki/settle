import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Prisma generated client lives at project root, not under src/
      {
        find: "@/generated",
        replacement: path.resolve(__dirname, "generated"),
      },
      // Redirect db module to test-safe client (no Neon adapter)
      {
        find: "@/server/db",
        replacement: path.resolve(__dirname, "src/test/db.ts"),
      },
      // Main alias — @/ prefix only, so @scoped npm packages are not matched
      {
        find: "@/",
        replacement: path.resolve(__dirname, "src") + "/",
      },
      // Stubs for modules that throw in non-server / non-Next.js environments
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "src/test/mocks/server-only.ts"),
      },
      {
        find: "next/headers",
        replacement: path.resolve(__dirname, "src/test/mocks/next-headers.ts"),
      },
      {
        find: "next/navigation",
        replacement: path.resolve(
          __dirname,
          "src/test/mocks/next-navigation.ts",
        ),
      },
      {
        find: "next/image",
        replacement: path.resolve(__dirname, "src/test/mocks/next-image.tsx"),
      },
      {
        find: "next/link",
        replacement: path.resolve(__dirname, "src/test/mocks/next-link.tsx"),
      },
    ],
  },
  test: {
    globalSetup: "./src/test/global-setup.ts",
    // Keep Playwright spec files out of the Vitest run
    exclude: ["**/node_modules/**", "**/.git/**", "tests/e2e/**"],
    // Default to node; jsdom is set per-file via the // @vitest-environment jsdom docblock.
    environment: "node",
    // jest-dom matchers — safe to import in node (no DOM calls at registration time)
    setupFiles: ["./src/test/jest-dom-setup.ts"],
    // All test files share the same Postgres database, so run files serially to
    // prevent TRUNCATE in one file from deadlocking with inserts in another.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/features/**/*.ts"],
      exclude: ["src/features/**/*.tsx", "src/features/**/__tests__/**"],
      thresholds: { lines: 85 },
    },
  },
});
