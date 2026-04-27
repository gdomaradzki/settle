import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// max:1 ensures all queries share one connection, enabling the
// transactional rollback reset pattern (BEGIN/ROLLBACK per test).
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 1,
});

const adapter = new PrismaPg(pool);

export const db = new PrismaClient({ adapter });
