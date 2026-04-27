import { randomUUID } from "crypto";
import { db } from "@/server/db";
import type { User, Vendor, Bill, BillEvent } from "@/generated/prisma/client";
import type { UserRole, PaymentMethod, BillStatus } from "@/generated/prisma/enums";

export async function createTestUser(
  overrides?: Partial<{
    name: string;
    email: string;
    role: UserRole;
  }>,
): Promise<User> {
  const row = await db.user.create({
    data: {
      name: overrides?.name ?? "Test User",
      email: overrides?.email ?? `test-${randomUUID()}@example.com`,
      role: overrides?.role ?? "SUBMITTER",
    },
  });
  return row as unknown as User;
}

export async function createTestVendor(
  overrides?: Partial<{
    name: string;
    email: string;
    paymentMethod: PaymentMethod;
  }>,
): Promise<Vendor> {
  const row = await db.vendor.create({
    data: {
      name: overrides?.name ?? `Test Vendor ${randomUUID().slice(0, 8)}`,
      email: overrides?.email ?? null,
      paymentMethod: overrides?.paymentMethod ?? "ACH",
    },
  });
  return row as unknown as Vendor;
}

export async function createTestBill(
  overrides?: Partial<{
    vendorId: string;
    amountCents: number;
    status: BillStatus;
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    createdById: string;
    submittedAt: Date;
    approvedAt: Date;
    approvedById: string;
    scheduledPayDate: Date;
    scheduledMethod: PaymentMethod;
  }>,
): Promise<Bill> {
  const now = new Date();
  const due = new Date(now.getTime() + 30 * 86_400_000);

  let vendorId = overrides?.vendorId;
  if (!vendorId) {
    const v = await createTestVendor();
    vendorId = v.id;
  }

  let createdById = overrides?.createdById;
  if (!createdById) {
    const u = await createTestUser();
    createdById = u.id;
  }

  const row = await db.bill.create({
    data: {
      vendorId,
      amountCents: overrides?.amountCents ?? 100_00,
      currency: "USD",
      issueDate: overrides?.issueDate ?? now,
      dueDate: overrides?.dueDate ?? due,
      status: overrides?.status ?? "DRAFT",
      invoiceNumber: overrides?.invoiceNumber ?? null,
      createdById,
      submittedAt: overrides?.submittedAt ?? null,
      approvedAt: overrides?.approvedAt ?? null,
      approvedById: overrides?.approvedById ?? null,
      scheduledPayDate: overrides?.scheduledPayDate ?? null,
      scheduledMethod: overrides?.scheduledMethod ?? null,
      lineItems: {
        create: [
          {
            description: "Test line item",
            amountCents: overrides?.amountCents ?? 100_00,
            type: "EXPENSE",
          },
        ],
      },
    },
  });
  return row as unknown as Bill;
}

export async function createTestBillEvent(
  billId: string,
  type: string,
  overrides?: Partial<{
    actorId: string;
    payload: Record<string, string>;
  }>,
): Promise<BillEvent> {
  let actorId = overrides?.actorId;
  if (!actorId) {
    const u = await createTestUser();
    actorId = u.id;
  }

  const row = await db.billEvent.create({
    data: {
      billId,
      type,
      actorId,
      payload: overrides?.payload ?? undefined,
    },
  });
  return row as unknown as BillEvent;
}
