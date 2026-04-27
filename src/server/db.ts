import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Use Neon adapter when DATABASE_URL_UNPOOLED is present (production/preview).
// Fall back to standard pg for local test environments (Docker Postgres).
function createClient() {
  if (process.env.DATABASE_URL_UNPOOLED) {
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_UNPOOLED }),
    });
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

type DbClient = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: DbClient };
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
