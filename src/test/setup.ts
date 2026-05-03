// resetWithTruncate() truncates all tables after each test.
// Use instead of BEGIN/ROLLBACK whenever the code under test calls db.$transaction()
// (Prisma's interactive transactions don't nest cleanly inside an outer BEGIN).

import { afterEach } from "vitest";
import { db } from "@/server/db";

export { db };

export function resetWithTruncate(): void {
  afterEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "BillEvent", "BillLineItem", "Bill", "BillTemplateLineItem", "BillTemplate", "Vendor", "User" RESTART IDENTITY CASCADE',
    );
  });
}
