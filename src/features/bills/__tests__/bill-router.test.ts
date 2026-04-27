import { describe, it, expect } from "vitest";
import { createCallerFactory } from "@/server/trpc";
import { billRouter } from "@/features/bills/bill-router";
import { resetWithTruncate } from "@/test/setup";
import { createTestUser, createTestVendor, createTestBill } from "@/test/factories";
import { APPROVAL_THRESHOLD_CENTS } from "@/features/approvals/approval-rules";
import type { User } from "@/generated/prisma/client";

resetWithTruncate();

const factory = createCallerFactory(billRouter);

function caller(user: User, isAuthenticated = true) {
  return factory({ user: user as never, isAuthenticated });
}

function baseInput(vendorId: string) {
  return {
    vendorId,
    amountCents: 10_000,
    issueDate: new Date("2026-01-01"),
    dueDate: new Date("2026-02-01"),
    lineItems: [{ description: "Test", amountCents: 10_000, type: "EXPENSE" as const }],
  };
}

// ─── list ─────────────────────────────────────────────────────────────────────

describe("bill.list", () => {
  it("returns all bills with no filter", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();
    await createTestBill({ createdById: user.id, vendorId: vendor.id });
    await createTestBill({ createdById: user.id, vendorId: vendor.id, status: "PENDING_APPROVAL" });

    const bills = await caller(user).list({});
    expect(bills.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by status", async () => {
    const user = await createTestUser();
    await createTestBill({ createdById: user.id, status: "DRAFT" });
    await createTestBill({ createdById: user.id, status: "APPROVED" });

    const drafts = await caller(user).list({ status: "DRAFT" });
    expect(drafts.every((b) => b.status === "DRAFT")).toBe(true);
  });

  it("returns empty for needsMyApproval when user is SUBMITTER", async () => {
    const user = await createTestUser({ role: "SUBMITTER" });
    await createTestBill({ status: "PENDING_APPROVAL" });

    const bills = await caller(user).list({ needsMyApproval: true });
    expect(bills).toHaveLength(0);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe("bill.get", () => {
  it("returns the bill with vendor, lineItems and events", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ createdById: user.id });

    const result = await caller(user).get(bill.id);
    expect(result.id).toBe(bill.id);
    expect(result.vendor).toBeDefined();
    expect(Array.isArray(result.lineItems)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("throws NOT_FOUND for an unknown id", async () => {
    const user = await createTestUser();
    await expect(caller(user).get("nonexistent-id")).rejects.toThrow();
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("bill.create", () => {
  it("creates a DRAFT bill when authenticated", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();

    const bill = await caller(user).create(baseInput(vendor.id));
    expect(bill.status).toBe("DRAFT");
    expect(bill.amountCents).toBe(10_000);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();

    await expect(
      caller(user, false).create(baseInput(vendor.id)),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── createAndSubmit ──────────────────────────────────────────────────────────

describe("bill.createAndSubmit", () => {
  it("creates and auto-approves an under-threshold bill", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();
    const input = { ...baseInput(vendor.id), amountCents: APPROVAL_THRESHOLD_CENTS - 1, lineItems: [{ description: "X", amountCents: APPROVAL_THRESHOLD_CENTS - 1 }] };

    const bill = await caller(user).createAndSubmit(input);
    expect(bill.status).toBe("APPROVED");
  });
});

// ─── submit ───────────────────────────────────────────────────────────────────

describe("bill.submit", () => {
  it("transitions DRAFT → PENDING_APPROVAL for an over-threshold bill", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ createdById: user.id, amountCents: APPROVAL_THRESHOLD_CENTS, status: "DRAFT" });

    const updated = await caller(user).submit(bill.id);
    expect(updated.status).toBe("PENDING_APPROVAL");
  });

  it("throws BAD_REQUEST when already submitted", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(caller(user).submit(bill.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "DRAFT" });

    await expect(caller(user, false).submit(bill.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── approve ──────────────────────────────────────────────────────────────────

describe("bill.approve", () => {
  it("transitions PENDING_APPROVAL → APPROVED for an APPROVER", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    const updated = await caller(approver).approve(bill.id);
    expect(updated.status).toBe("APPROVED");
  });

  it("throws FORBIDDEN when caller is a SUBMITTER", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(caller(submitter).approve(bill.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── reject ───────────────────────────────────────────────────────────────────

describe("bill.reject", () => {
  it("transitions PENDING_APPROVAL → REJECTED with a reason", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    const updated = await caller(approver).reject({ billId: bill.id, reason: "Duplicate" });
    expect(updated.status).toBe("REJECTED");
    expect(updated.rejectedReason).toBe("Duplicate");
  });

  it("throws FORBIDDEN when caller is a SUBMITTER", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(
      caller(submitter).reject({ billId: bill.id, reason: "No" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── schedule ─────────────────────────────────────────────────────────────────

describe("bill.schedule", () => {
  it("transitions APPROVED → SCHEDULED", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "APPROVED" });

    const updated = await caller(user).schedule({
      billId: bill.id,
      payDate: new Date("2026-06-01"),
      method: "ACH",
    });
    expect(updated.status).toBe("SCHEDULED");
  });

  it("throws BAD_REQUEST when source is not APPROVED", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "DRAFT" });

    await expect(
      caller(user).schedule({ billId: bill.id, payDate: new Date(), method: "ACH" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── pay ──────────────────────────────────────────────────────────────────────

describe("bill.pay", () => {
  it("transitions SCHEDULED → PAID", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "SCHEDULED", scheduledPayDate: new Date(), scheduledMethod: "ACH" });

    const updated = await caller(user).pay(bill.id);
    expect(updated.status).toBe("PAID");
    expect(updated.paymentConfirmation).toMatch(/^SETTLE-/);
  });

  it("throws BAD_REQUEST when source is not SCHEDULED", async () => {
    const user = await createTestUser();
    const bill = await createTestBill({ status: "APPROVED" });

    await expect(caller(user).pay(bill.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── createMany ───────────────────────────────────────────────────────────────

describe("bill.createMany", () => {
  it("creates multiple DRAFT bills in one call", async () => {
    const user = await createTestUser();
    const vendor = await createTestVendor();

    const result = await caller(user).createMany([
      baseInput(vendor.id),
      { ...baseInput(vendor.id), amountCents: 20_000, lineItems: [{ description: "B", amountCents: 20_000 }] },
    ]);
    expect(result.created).toBe(2);
  });
});
