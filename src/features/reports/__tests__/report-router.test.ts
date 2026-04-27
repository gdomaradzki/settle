import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { reportRouter } from "@/features/reports/report-router";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestBill } from "@/test/factories";
import type { User } from "@/generated/prisma/client";

resetWithTruncate();

const factory = createCallerFactory(reportRouter);

function caller(user: User) {
  return factory({ user: user as never, isAuthenticated: true });
}

describe("reports.apAging", () => {
  it("returns a report with asOf, vendorRows and totals fields", async () => {
    const user = await createTestUser();
    const report = await caller(user).apAging();

    expect(report.asOf).toBeInstanceOf(Date);
    expect(Array.isArray(report.vendorRows)).toBe(true);
    expect(report.totals).toMatchObject({
      current: expect.any(Number),
      d1to30: expect.any(Number),
      d31to60: expect.any(Number),
      d61plus: expect.any(Number),
    });
  });

  it("includes an outstanding bill in the totals", async () => {
    const user = await createTestUser();
    await createTestBill({
      status: "APPROVED",
      amountCents: 75_000,
      dueDate: new Date(Date.now() + 5 * 86_400_000),
      createdById: user.id,
    });

    const report = await caller(user).apAging();
    const totalAll =
      report.totals.current +
      report.totals.d1to30 +
      report.totals.d31to60 +
      report.totals.d61plus;
    expect(totalAll).toBeGreaterThanOrEqual(75_000);
  });
});
