import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { dashboardRouter } from "@/features/dashboard/dashboard-router";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestBill } from "@/test/factories";
import type { User } from "@/generated/prisma/client";

resetWithTruncate();

const factory = createCallerFactory(dashboardRouter);

function caller(user: User) {
  return factory({ user: user as never, isAuthenticated: true });
}

describe("dashboard.summary", () => {
  it("returns the four metrics and recentEvents", async () => {
    const user = await createTestUser();
    const summary = await caller(user).summary();

    expect(typeof summary.needsMyApproval).toBe("number");
    expect(typeof summary.dueThisWeek).toBe("number");
    expect(typeof summary.cashOutCents).toBe("number");
    expect(Array.isArray(summary.recentEvents)).toBe(true);
  });

  it("needsMyApproval is 0 for a SUBMITTER context", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    await createTestBill({ status: "PENDING_APPROVAL" });

    const summary = await caller(submitter).summary();
    expect(summary.needsMyApproval).toBe(0);
  });

  it("needsMyApproval counts PENDING_APPROVAL bills for an APPROVER", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    await createTestBill({ status: "PENDING_APPROVAL" });
    await createTestBill({ status: "PENDING_APPROVAL" });

    const summary = await caller(approver).summary();
    expect(summary.needsMyApproval).toBeGreaterThanOrEqual(2);
  });

  it("cashOutCents sums APPROVED and SCHEDULED bills due within 30 days", async () => {
    const user = await createTestUser();
    await createTestBill({
      status: "APPROVED",
      amountCents: 40_000,
      dueDate: new Date(Date.now() + 10 * 86_400_000),
      createdById: user.id,
    });

    const summary = await caller(user).summary();
    expect(summary.cashOutCents).toBeGreaterThanOrEqual(40_000);
  });
});
