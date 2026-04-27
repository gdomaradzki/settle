import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

// Load .env.test so TEST_DATABASE_URL is available for the webServer env block
// (Playwright's config file runs as plain Node — Vite env loading doesn't apply).
config({ path: path.resolve(__dirname, ".env.test") });

const testDbUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run on port 3001 so e2e tests never collide with a dev server on 3000.
    command: "npm run dev -- --port 3001",
    // Use a static asset as the ready-check URL: it returns 200 regardless of
    // database state, so a running dev server is never mistaken for "not ready".
    url: "http://localhost:3001/favicon.ico",
    reuseExistingServer: !!process.env.CI,
    env: {
      // Only set DATABASE_URL — Docker Postgres uses plain TCP, not Neon's
      // WebSocket protocol, so setting DATABASE_URL_UNPOOLED would cause
      // db.ts to pick the PrismaNeon adapter and fail to connect.
      DATABASE_URL: testDbUrl,
    },
  },
  globalSetup: "./tests/e2e/global-setup.ts",
});
