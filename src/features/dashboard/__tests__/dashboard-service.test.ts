import { describe, it, expect } from "vitest";
import { resetWithTruncate } from "@/test/setup";
import {
  createTestUser,
  createTestBill,
  createTestBillEvent,
} from "@/test/factories";
import { getDashboardSummary } from "@/features/dashboard/dashboard-service";

resetWithTruncate();

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe("getDashboardSummary", () => {
  describe("needsMyApproval", () => {
    it("is 0 for a SUBMITTER regardless of pending-approval bills", async () => {
      const submitter = await createTestUser({ role: "SUBMITTER" });
      await createTestBill({ status: "PENDING_APPROVAL" });

      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.needsMyApproval).toBe(0);
    });

    it("reflects the count of PENDING_APPROVAL bills for an APPROVER", async () => {
      const approver = await createTestUser({ role: "APPROVER" });
      await createTestBill({ status: "PENDING_APPROVAL" });
      await createTestBill({ status: "PENDING_APPROVAL" });

      const summary = await getDashboardSummary(approver.id, "APPROVER");
      expect(summary.needsMyApproval).toBeGreaterThanOrEqual(2);
    });
  });

  describe("dueThisWeek", () => {
    it("counts PENDING_APPROVAL, APPROVED, and SCHEDULED bills due within 7 days", async () => {
      await createTestBill({ status: "APPROVED", dueDate: daysFromNow(3) });
      await createTestBill({ status: "SCHEDULED", dueDate: daysFromNow(6), scheduledPayDate: new Date(), scheduledMethod: "ACH" });
      await createTestBill({ status: "PENDING_APPROVAL", dueDate: daysFromNow(1) });

      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.dueThisWeek).toBeGreaterThanOrEqual(3);
    });

    it("excludes bills due more than 7 days from now", async () => {
      await createTestBill({ status: "APPROVED", dueDate: daysFromNow(10) });

      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.dueThisWeek).toBe(0);
    });

    it("excludes past-due bills from dueThisWeek", async () => {
      await createTestBill({ status: "APPROVED", dueDate: daysAgo(2) });

      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.dueThisWeek).toBe(0);
    });
  });

  describe("cashOutCents", () => {
    it("sums APPROVED and SCHEDULED bills due within 30 days", async () => {
      await createTestBill({
        status: "APPROVED",
        amountCents: 50_000,
        dueDate: daysFromNow(15),
      });
      await createTestBill({
        status: "SCHEDULED",
        amountCents: 30_000,
        dueDate: daysFromNow(25),
        scheduledPayDate: new Date(),
        scheduledMethod: "ACH",
      });

      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.cashOutCents).toBeGreaterThanOrEqual(80_000);
    });

    it("excludes PAID bills", async () => {
      await createTestBill({
        status: "PAID",
        amountCents: 99_999,
        dueDate: daysFromNow(5),
      });

      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.cashOutCents).toBe(0);
    });

    it("returns 0 when no qualifying bills exist", async () => {
      const submitter = await createTestUser();
      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.cashOutCents).toBe(0);
    });
  });

  describe("recentEvents", () => {
    it("returns at most 8 events ordered by createdAt desc", async () => {
      const submitter = await createTestUser();
      const bill = await createTestBill({ createdById: submitter.id });

      // Create 9 events — only 8 should appear
      for (let i = 0; i < 9; i++) {
        await createTestBillEvent(bill.id, `event-${i}`, { actorId: submitter.id });
      }

      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      expect(summary.recentEvents.length).toBeLessThanOrEqual(8);
    });

    it("resolves actor name from the user table", async () => {
      const submitter = await createTestUser({ name: "Gus Silva" });
      const bill = await createTestBill({ createdById: submitter.id });
      await createTestBillEvent(bill.id, "submitted", { actorId: submitter.id });

      const summary = await getDashboardSummary(submitter.id, "SUBMITTER");
      const ev = summary.recentEvents.find((e) => e.actorId === submitter.id);
      expect(ev?.actorName).toBe("Gus Silva");
    });
  });
});
