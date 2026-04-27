import { execSync } from "child_process";
import { readFileSync } from "fs";
import { config } from "dotenv";
import path from "path";
import { Pool } from "pg";

export async function setup(): Promise<void> {
  // Load .env.test so TEST_DATABASE_URL is available in globalSetup context
  // (Vite's env loading only applies to worker threads, not this main-process hook)
  config({ path: path.resolve(process.cwd(), ".env.test") });

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Create .env.test with:\n" +
        "TEST_DATABASE_URL=postgresql://postgres:test@localhost:5433/test\n" +
        "Then start the test database: docker compose -f docker-compose.test.yml up -d",
    );
  }

  // --url bypasses prisma.config.ts's datasource block so DATABASE_URL_UNPOOLED
  // in the developer's shell can never accidentally route the push to Neon.
  console.log("[test] Applying schema to test database...");
  execSync(`npx prisma db push --schema ./prisma/schema.prisma --url "${url}"`, {
    stdio: "pipe",
  });

  const pool = new Pool({ connectionString: url });

  // Apply the case-insensitive unique index on Vendor.name — db push doesn't
  // create it (it lives in prisma/sql/vendor-name-unique.sql, run separately
  // in dev via db:case-index). The IF NOT EXISTS guard makes this idempotent.
  console.log("[test] Applying vendor name index...");
  const vendorIndexSql = readFileSync(
    path.resolve(process.cwd(), "prisma/sql/vendor-name-unique.sql"),
    "utf8",
  );
  await pool.query(vendorIndexSql);

  // Truncate all tables so every run starts with a clean slate regardless of
  // whether a previous run crashed before its afterEach cleanup ran.
  console.log("[test] Truncating tables...");
  await pool.query(
    'TRUNCATE "BillEvent", "BillLineItem", "Bill", "Vendor", "User" RESTART IDENTITY CASCADE',
  );
  await pool.end();

  console.log("[test] Test database ready.");
}
