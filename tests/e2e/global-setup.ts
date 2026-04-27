import { execSync } from "child_process";
import { config } from "dotenv";
import path from "path";

export default async function globalSetup(): Promise<void> {
  config({ path: path.resolve(process.cwd(), ".env.test") });

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Create .env.test first.");
  }

  // Force seed.ts to use the PrismaPg fallback by removing the Neon-specific var.
  const testEnv = { ...process.env, DATABASE_URL: url } as NodeJS.ProcessEnv;
  delete testEnv.DATABASE_URL_UNPOOLED;

  console.log("[e2e] Applying schema + seeding test database...");

  execSync(`npx prisma db push --schema ./prisma/schema.prisma --url "${url}"`, {
    stdio: "pipe",
  });

  execSync("npx prisma db seed", {
    env: testEnv,
    stdio: "pipe",
  });

  console.log("[e2e] Test database ready.");
}
