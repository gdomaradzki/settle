import { describe, it, expect, beforeEach } from "vitest";
import { db, resetWithTruncate } from "@/test/setup";
import {
  createTestUser,
  createTestVendor,
  createTestBill,
} from "@/test/factories";
import {
  createBill,
  submitBill,
  approveBill,
  rejectBill,
  scheduleBill,
  payBill,
  createAndSubmitBill,
  createManyBills,
  listBills,
  getBill,
} from "@/features/bills/bill-service";
import {
  InvalidTransitionError,
  UnauthorizedError,
} from "@/features/bills/errors";
import { APPROVAL_THRESHOLD_CENTS } from "@/features/approvals/approval-rules";

resetWithTruncate();

// ─── helpers ─────────────────────────────────────────────────────────────────

async function countEvents(billId: string): Promise<number> {
  return db.billEvent.count({ where: { billId } });
}

async function lastEvent(billId: string) {
  return db.billEvent.findFirst({
    where: { billId },
    orderBy: { createdAt: "desc" },
  });
}

const UNDER_THRESHOLD = APPROVAL_THRESHOLD_CENTS - 1;
const OVER_THRESHOLD = APPROVAL_THRESHOLD_CENTS;

// ─── createBill ───────────────────────────────────────────────────────────────

describe("createBill", () => {
  it("creates a DRAFT bill with a created event", async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();

    const bill = await createBill(
      {
        vendorId: vendor.id,
        amountCents: 50_00,
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2026-01-31"),
        lineItems: [
          { description: "Consulting", amountCents: 50_00, type: "EXPENSE" },
        ],
      },
      submitter.id,
    );

    expect(bill.status).toBe("DRAFT");
    expect(bill.amountCents).toBe(50_00);
    expect(bill.createdById).toBe(submitter.id);

    const count = await countEvents(bill.id);
    expect(count).toBe(1);

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("created");
    expect(ev?.actorId).toBe(submitter.id);
  });
});

// ─── submitBill — under threshold ────────────────────────────────────────────

describe("submitBill (under threshold)", () => {
  it("transitions DRAFT → APPROVED and writes two events when under $5,000", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({
      amountCents: UNDER_THRESHOLD,
      createdById: submitter.id,
      status: "DRAFT",
    });

    const updated = await submitBill(bill.id, submitter.id);

    expect(updated.status).toBe("APPROVED");
    expect(updated.submittedAt).toBeTruthy();
    expect(updated.approvedAt).toBeTruthy();
    expect(updated.approvedById).toBe(submitter.id);

    const count = await countEvents(bill.id);
    expect(count).toBe(2); // submitted + auto-approved

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("approved");
    expect((ev?.payload as Record<string, string>)?.autoApproved).toBe("true");
  });
});

// ─── submitBill — at/over threshold ──────────────────────────────────────────

describe("submitBill (at/over threshold)", () => {
  it("transitions DRAFT → PENDING_APPROVAL at $5,000 and writes one submitted event", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({
      amountCents: OVER_THRESHOLD,
      createdById: submitter.id,
      status: "DRAFT",
    });

    const updated = await submitBill(bill.id, submitter.id);

    expect(updated.status).toBe("PENDING_APPROVAL");
    expect(updated.submittedAt).toBeTruthy();
    expect(updated.approvedAt).toBeNull();

    const count = await countEvents(bill.id);
    expect(count).toBe(1);

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("submitted");
    expect((ev?.payload as Record<string, string>)?.toStatus).toBe(
      "PENDING_APPROVAL",
    );
  });
});

// ─── approveBill ──────────────────────────────────────────────────────────────

describe("approveBill", () => {
  it("transitions PENDING_APPROVAL → APPROVED and records an approved event", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    const updated = await approveBill(bill.id, approver.id);

    expect(updated.status).toBe("APPROVED");
    expect(updated.approvedAt).toBeTruthy();
    expect(updated.approvedById).toBe(approver.id);

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("approved");
    expect(ev?.actorId).toBe(approver.id);
  });

  it("rejects if the actor is a SUBMITTER", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(approveBill(bill.id, submitter.id)).rejects.toThrow(
      UnauthorizedError,
    );
    const refreshed = (await db.bill.findUniqueOrThrow({
      where: { id: bill.id },
    })) as { status: string };
    expect(refreshed.status).toBe("PENDING_APPROVAL");
  });

  it("rejects invalid source status DRAFT", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "DRAFT" });

    await expect(approveBill(bill.id, approver.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });
});

// ─── rejectBill ──────────────────────────────────────────────────────────────

describe("rejectBill", () => {
  it("transitions PENDING_APPROVAL → REJECTED and records a rejected event with reason", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    const updated = await rejectBill(bill.id, approver.id, "Duplicate invoice");

    expect(updated.status).toBe("REJECTED");
    expect(updated.rejectedAt).toBeTruthy();
    expect(updated.rejectedReason).toBe("Duplicate invoice");

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("rejected");
    expect((ev?.payload as Record<string, string>)?.reason).toBe(
      "Duplicate invoice",
    );
  });

  it("rejects if the actor is a SUBMITTER", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(rejectBill(bill.id, submitter.id, "reason")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects invalid source status APPROVED", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "APPROVED" });

    await expect(rejectBill(bill.id, approver.id, "reason")).rejects.toThrow(
      InvalidTransitionError,
    );
  });
});

// ─── scheduleBill ────────────────────────────────────────────────────────────

describe("scheduleBill", () => {
  it("transitions APPROVED → SCHEDULED and records a scheduled event", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "APPROVED" });
    const payDate = new Date("2026-06-01");

    const updated = await scheduleBill(bill.id, submitter.id, payDate, "ACH");

    expect(updated.status).toBe("SCHEDULED");
    expect(updated.scheduledPayDate?.toISOString()).toBe(payDate.toISOString());
    expect(updated.scheduledMethod).toBe("ACH");

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("scheduled");
    expect((ev?.payload as Record<string, string>)?.method).toBe("ACH");
  });

  it("rejects invalid source status PENDING_APPROVAL", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(
      scheduleBill(bill.id, submitter.id, new Date(), "ACH"),
    ).rejects.toThrow(InvalidTransitionError);
  });
});

// ─── payBill ─────────────────────────────────────────────────────────────────

describe("payBill", () => {
  it("transitions SCHEDULED → PAID and records a paid event with confirmation number", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({
      status: "SCHEDULED",
      scheduledPayDate: new Date(),
      scheduledMethod: "ACH",
    });

    const updated = await payBill(bill.id, submitter.id);

    expect(updated.status).toBe("PAID");
    expect(updated.paidAt).toBeTruthy();
    expect(updated.paymentConfirmation).toMatch(/^SETTLE-/);

    const ev = await lastEvent(bill.id);
    expect(ev?.type).toBe("paid");
    expect((ev?.payload as Record<string, string>)?.confirmation).toMatch(
      /^SETTLE-/,
    );
  });

  it("rejects invalid source status APPROVED", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "APPROVED" });

    await expect(payBill(bill.id, submitter.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("rejects invalid source status DRAFT", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "DRAFT" });

    await expect(payBill(bill.id, submitter.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });
});

// ─── invalid transitions ──────────────────────────────────────────────────────

describe("invalid transitions", () => {
  it("cannot submit a PENDING_APPROVAL bill", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "PENDING_APPROVAL" });

    await expect(submitBill(bill.id, submitter.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("cannot submit a PAID bill", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "PAID" });

    await expect(submitBill(bill.id, submitter.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("cannot approve an APPROVED bill", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bill = await createTestBill({ status: "APPROVED" });

    await expect(approveBill(bill.id, approver.id)).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("cannot schedule a PAID bill", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ status: "PAID" });

    await expect(
      scheduleBill(bill.id, submitter.id, new Date(), "ACH"),
    ).rejects.toThrow(InvalidTransitionError);
  });
});

// ─── createAndSubmitBill ──────────────────────────────────────────────────────

describe("createAndSubmitBill", () => {
  it("creates and auto-approves in one transaction when under threshold", async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();

    const bill = await createAndSubmitBill(
      {
        vendorId: vendor.id,
        amountCents: UNDER_THRESHOLD,
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2026-02-01"),
        lineItems: [
          { description: "Widget", amountCents: UNDER_THRESHOLD, type: "ITEM" },
        ],
      },
      submitter.id,
    );

    expect(bill.status).toBe("APPROVED");
    // created + submitted + auto-approved
    const count = await countEvents(bill.id);
    expect(count).toBe(3);
  });

  it("creates and puts in PENDING_APPROVAL when over threshold", async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();

    const bill = await createAndSubmitBill(
      {
        vendorId: vendor.id,
        amountCents: OVER_THRESHOLD,
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2026-02-01"),
        lineItems: [
          {
            description: "Big ticket",
            amountCents: OVER_THRESHOLD,
            type: "EXPENSE",
          },
        ],
      },
      submitter.id,
    );

    expect(bill.status).toBe("PENDING_APPROVAL");
    const count = await countEvents(bill.id);
    expect(count).toBe(2); // created + submitted
  });
});

// ─── atomicity ────────────────────────────────────────────────────────────────

describe("atomicity", () => {
  it("no partial state persists when a transaction is forced to fail", async () => {
    const submitter = await createTestUser();

    // Pass an invalid lineItem that will cause a DB constraint violation mid-transaction
    // by providing a negative amountCents (violates the Prisma Int check or causes an error).
    // We simulate this by using an invalid vendorId so the bill.create itself fails.
    const invalidVendorId = "nonexistent-vendor-id";

    await expect(
      createBill(
        {
          vendorId: invalidVendorId,
          amountCents: 100_00,
          issueDate: new Date(),
          dueDate: new Date(),
          lineItems: [{ description: "Test", amountCents: 100_00 }],
        },
        submitter.id,
      ),
    ).rejects.toThrow();

    // No bill should have been created
    const count = await db.bill.count({ where: { createdById: submitter.id } });
    expect(count).toBe(0);

    // No orphaned events
    const eventCount = await db.billEvent.count();
    expect(eventCount).toBe(0);
  });
});

// ─── createManyBills ──────────────────────────────────────────────────────────

describe("createManyBills", () => {
  it("creates multiple DRAFT bills in one transaction", async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();

    const result = await createManyBills(
      [
        {
          vendorId: vendor.id,
          amountCents: 10_00,
          issueDate: new Date("2026-01-01"),
          dueDate: new Date("2026-02-01"),
          lineItems: [{ description: "A", amountCents: 10_00 }],
        },
        {
          vendorId: vendor.id,
          amountCents: 20_00,
          issueDate: new Date("2026-01-01"),
          dueDate: new Date("2026-02-01"),
          lineItems: [{ description: "B", amountCents: 20_00 }],
        },
      ],
      submitter.id,
    );

    expect(result.created).toBe(2);

    const bills = await db.bill.findMany({
      where: { createdById: submitter.id },
    });
    expect(bills).toHaveLength(2);
    bills.forEach((b) => {
      expect(b.status as string).toBe("DRAFT");
    });
  });
});

// ─── listBills ────────────────────────────────────────────────────────────────

describe("listBills", () => {
  beforeEach(async () => {
    const submitter = await createTestUser();
    const vendor = await createTestVendor();
    await createTestBill({
      createdById: submitter.id,
      vendorId: vendor.id,
      status: "DRAFT",
    });
    await createTestBill({
      createdById: submitter.id,
      vendorId: vendor.id,
      status: "PENDING_APPROVAL",
    });
  });

  it("returns all bills with no filter", async () => {
    const submitter = await createTestUser();
    const bills = await listBills({}, submitter.id, "SUBMITTER");
    expect(bills.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by status", async () => {
    const submitter = await createTestUser();
    const bills = await listBills(
      { status: "DRAFT" },
      submitter.id,
      "SUBMITTER",
    );
    expect(bills.every((b) => b.status === "DRAFT")).toBe(true);
  });

  it("returns empty array for needsMyApproval when actor is SUBMITTER", async () => {
    const submitter = await createTestUser({ role: "SUBMITTER" });
    const bills = await listBills(
      { needsMyApproval: true },
      submitter.id,
      "SUBMITTER",
    );
    expect(bills).toHaveLength(0);
  });

  it("returns PENDING_APPROVAL bills for needsMyApproval when actor is APPROVER", async () => {
    const approver = await createTestUser({ role: "APPROVER" });
    const bills = await listBills(
      { needsMyApproval: true },
      approver.id,
      "APPROVER",
    );
    expect(bills.length).toBeGreaterThanOrEqual(1);
    expect(bills.every((b) => b.status === "PENDING_APPROVAL")).toBe(true);
  });
});

// ─── getBill ─────────────────────────────────────────────────────────────────

describe("getBill", () => {
  it("returns a bill with vendor, lineItems, and events", async () => {
    const submitter = await createTestUser();
    const bill = await createTestBill({ createdById: submitter.id });

    const full = await getBill(bill.id);

    expect(full.id).toBe(bill.id);
    expect(full.vendor).toBeDefined();
    expect(Array.isArray(full.lineItems)).toBe(true);
    expect(Array.isArray(full.events)).toBe(true);
  });

  it("throws when the bill does not exist", async () => {
    await expect(getBill("nonexistent-id")).rejects.toThrow();
  });
});
