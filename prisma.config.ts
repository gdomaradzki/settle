import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use the direct (unpooled) connection for all CLI operations — Neon's pooler
// doesn't support the DDL traffic that `prisma db push` and migrate emit.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
