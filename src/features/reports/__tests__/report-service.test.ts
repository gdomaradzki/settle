import { describe, it, expect } from "vitest";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestVendor, createTestBill } from "@/test/factories";
import { getApAgingReport } from "@/features/reports/report-service";

resetWithTruncate();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

describe("getApAgingReport", () => {
  it("returns empty report when no outstanding bills exist", async () => {
    const report = await getApAgingReport();
    expect(report.vendorRows).toHaveLength(0);
    expect(report.totals).toEqual({ current: 0, d1to30: 0, d31to60: 0, d61plus: 0 });
  });

  it("buckets a current bill (due in future) into current", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 10_000,
      status: "APPROVED",
      dueDate: daysFromNow(10),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    expect(report.totals.current).toBe(10_000);
    expect(report.totals.d1to30).toBe(0);
  });

  it("buckets a bill 15 days overdue into d1to30", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 20_000,
      status: "PENDING_APPROVAL",
      dueDate: daysAgo(15),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    expect(report.totals.d1to30).toBeGreaterThanOrEqual(20_000);
    expect(report.billCount.d1to30).toBeGreaterThanOrEqual(1);
  });

  it("buckets a bill 45 days overdue into d31to60", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 30_000,
      status: "SCHEDULED",
      dueDate: daysAgo(45),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    expect(report.totals.d31to60).toBeGreaterThanOrEqual(30_000);
  });

  it("buckets a bill 75 days overdue into d61plus", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 40_000,
      status: "APPROVED",
      dueDate: daysAgo(75),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    expect(report.totals.d61plus).toBeGreaterThanOrEqual(40_000);
  });

  it("excludes PAID bills from the report", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 99_000,
      status: "PAID",
      dueDate: daysAgo(5),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    const totalAll =
      report.totals.current +
      report.totals.d1to30 +
      report.totals.d31to60 +
      report.totals.d61plus;
    expect(totalAll).toBe(0);
  });

  it("excludes REJECTED bills from the report", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 50_000,
      status: "REJECTED",
      dueDate: daysAgo(5),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    const totalAll =
      report.totals.current +
      report.totals.d1to30 +
      report.totals.d31to60 +
      report.totals.d61plus;
    expect(totalAll).toBe(0);
  });

  it("excludes DRAFT bills from the report", async () => {
    const submitter = await createTestUser();
    await createTestBill({
      amountCents: 15_000,
      status: "DRAFT",
      dueDate: daysAgo(5),
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    const totalAll =
      report.totals.current +
      report.totals.d1to30 +
      report.totals.d31to60 +
      report.totals.d61plus;
    expect(totalAll).toBe(0);
  });

  it("groups bills by vendor into a single row", async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();

    await createTestBill({
      amountCents: 10_000,
      status: "APPROVED",
      dueDate: daysFromNow(5),
      vendorId: vendor.id,
      createdById: submitter.id,
    });
    await createTestBill({
      amountCents: 20_000,
      status: "APPROVED",
      dueDate: daysAgo(15),
      vendorId: vendor.id,
      createdById: submitter.id,
    });

    const report = await getApAgingReport();
    const row = report.vendorRows.find((r) => r.vendorId === vendor.id);
    expect(row).toBeDefined();
    expect(row!.current).toBe(10_000);
    expect(row!.d1to30).toBe(20_000);
  });

  it("grand totals match the sum across all vendor rows", async () => {
    const submitter = await createTestUser();
    const v1 = await createTestVendor();
    const v2 = await createTestVendor();

    await createTestBill({ amountCents: 5_000, status: "APPROVED", dueDate: daysFromNow(3), vendorId: v1.id, createdById: submitter.id });
    await createTestBill({ amountCents: 8_000, status: "PENDING_APPROVAL", dueDate: daysAgo(10), vendorId: v2.id, createdById: submitter.id });

    const report = await getApAgingReport();

    const rowSum =
      report.vendorRows.reduce((s, r) => s + r.current + r.d1to30 + r.d31to60 + r.d61plus, 0);
    const grandTotal =
      report.totals.current +
      report.totals.d1to30 +
      report.totals.d31to60 +
      report.totals.d61plus;

    expect(rowSum).toBe(grandTotal);
    expect(grandTotal).toBeGreaterThanOrEqual(13_000);
  });
});
