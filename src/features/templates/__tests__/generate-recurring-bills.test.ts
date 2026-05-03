import { describe, it, expect } from "vitest";
import { db, resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestVendor } from "@/test/factories";
import { runJob } from "@/server/cron/runner";
import type { PaymentMethod } from "@/generated/prisma/enums";

resetWithTruncate();

type CreateTemplateOptions = {
  paymentDayOfMonth: number;
  paymentMethod?: PaymentMethod;
  cancelledAt?: Date | null;
  description?: string;
};

async function createRecurringTemplate(opts: CreateTemplateOptions) {
  const user = await createTestUser();
  const vendor = await createTestVendor({
    paymentMethod: opts.paymentMethod ?? "ACH",
  });
  return db.billTemplate.create({
    data: {
      vendorId: vendor.id,
      description: opts.description ?? "Test template",
      amountCents: 100_00,
      paymentDayOfMonth: opts.paymentDayOfMonth,
      createdById: user.id,
      cancelledAt: opts.cancelledAt ?? null,
      lineItems: {
        create: [{ description: "Service", amountCents: 100_00 }],
      },
    },
  });
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("generate-recurring-bills cron", () => {
  it("generates an ACH bill 10 days before its payment day", async () => {
    const template = await createRecurringTemplate({
      paymentDayOfMonth: 15,
      paymentMethod: "ACH",
    });

    const result = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);

    const bills = await db.bill.findMany({
      where: { recurringTemplateId: template.id },
    });
    expect(bills).toHaveLength(1);
    const bill = bills[0] as {
      status: string;
      scheduledPayDate: Date | null;
      dueDate: Date;
      scheduledMethod: string | null;
    };
    expect(bill.status).toBe("SCHEDULED");
    expect(bill.scheduledPayDate?.toISOString()).toBe(
      utc(2026, 4, 15).toISOString(),
    );
    expect(bill.dueDate.toISOString()).toBe(utc(2026, 4, 15).toISOString());
    expect(bill.scheduledMethod).toBe("ACH");
  });

  it("generates a CHECK bill 15 days before its payment day", async () => {
    const template = await createRecurringTemplate({
      paymentDayOfMonth: 20,
      paymentMethod: "CHECK",
    });

    const result = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });

    expect(result.processed).toBe(1);
    const bills = await db.bill.findMany({
      where: { recurringTemplateId: template.id },
    });
    expect(bills).toHaveLength(1);
    const bill = bills[0] as { scheduledPayDate: Date | null };
    expect(bill.scheduledPayDate?.toISOString()).toBe(
      utc(2026, 4, 20).toISOString(),
    );
  });

  it("does not generate when today + leadDays does not match paymentDayOfMonth", async () => {
    await createRecurringTemplate({
      paymentDayOfMonth: 15,
      paymentMethod: "ACH",
    });

    const result = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 6),
    });

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(0);
    const billCount = await db.bill.count();
    expect(billCount).toBe(0);
  });

  it("uses the correct lead time per vendor's payment method", async () => {
    // Both templates pay on day 20. ACH should fire on day 10 (20-10),
    // CHECK should fire on day 5 (20-15).
    const ach = await createRecurringTemplate({
      paymentDayOfMonth: 20,
      paymentMethod: "ACH",
      description: "ACH template",
    });
    const check = await createRecurringTemplate({
      paymentDayOfMonth: 20,
      paymentMethod: "CHECK",
      description: "CHECK template",
    });

    // Run on day 5 → only CHECK fires
    const r1 = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });
    expect(r1.processed).toBe(1);
    const checkBills = await db.bill.findMany({
      where: { recurringTemplateId: check.id },
    });
    expect(checkBills).toHaveLength(1);
    const achBills = await db.bill.findMany({
      where: { recurringTemplateId: ach.id },
    });
    expect(achBills).toHaveLength(0);

    // Run on day 10 → ACH fires
    const r2 = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 10),
    });
    expect(r2.processed).toBe(1);
    const achBills2 = await db.bill.findMany({
      where: { recurringTemplateId: ach.id },
    });
    expect(achBills2).toHaveLength(1);
  });

  it("handles month rollover for the lead-time window", async () => {
    // ACH paymentDay=4, run on Jan 25 → target = Feb 4
    const template = await createRecurringTemplate({
      paymentDayOfMonth: 4,
      paymentMethod: "ACH",
    });

    const result = await runJob("generate-recurring-bills", {
      now: utc(2026, 1, 25),
    });

    expect(result.processed).toBe(1);
    const bills = await db.bill.findMany({
      where: { recurringTemplateId: template.id },
    });
    const bill = bills[0] as { scheduledPayDate: Date | null };
    expect(bill.scheduledPayDate?.toISOString()).toBe(
      utc(2026, 2, 4).toISOString(),
    );
  });

  it("excludes cancelled templates", async () => {
    await createRecurringTemplate({
      paymentDayOfMonth: 15,
      paymentMethod: "ACH",
      cancelledAt: new Date("2026-03-01"),
    });

    const result = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });

    expect(result.processed).toBe(0);
    expect(await db.bill.count()).toBe(0);
  });

  it("a second run on the same day skips already-generated bills", async () => {
    await createRecurringTemplate({
      paymentDayOfMonth: 15,
      paymentMethod: "ACH",
    });

    const r1 = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });
    expect(r1.processed).toBe(1);

    const r2 = await runJob("generate-recurring-bills", {
      now: utc(2026, 4, 5),
    });
    expect(r2.processed).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(r2.errors).toEqual([]);
    expect(await db.bill.count()).toBe(1);
  });
});
