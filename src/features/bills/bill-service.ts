import "server-only";
import type {
  Bill,
  Vendor,
  BillLineItem,
  BillEvent,
  BillTemplate,
  BillTemplateLineItem,
} from "@/generated/prisma/client";
import type { BillStatus, PaymentMethod } from "@/generated/prisma/enums";

export type BillWithVendor = Bill & { vendor: Vendor };
export type BillWithRelations = Bill & {
  vendor: Vendor;
  lineItems: BillLineItem[];
  events: BillEvent[];
};
export type TemplateWithVendorAndLineItems = BillTemplate & {
  vendor: Vendor;
  lineItems: BillTemplateLineItem[];
};
import { db } from "@/server/db";
import { requiresApproval } from "@/features/approvals/approval-rules";
import { InvalidTransitionError, UnauthorizedError } from "./errors";
import type {
  CreateBillInput,
  UpdateBillInput,
  ListBillsInput,
} from "./schemas";

// ─── Inner helpers (take a tx client — safe to compose in one transaction) ───

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function createBillInner(
  tx: Tx,
  input: CreateBillInput,
  actorId: string,
  eventPayload?: Record<string, string>,
): Promise<Bill> {
  const bill = await tx.bill.create({
    data: {
      vendorId: input.vendorId,
      invoiceNumber: input.invoiceNumber,
      amountCents: input.amountCents,
      currency: "USD",
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: "DRAFT",
      memo: input.memo,
      glCategory: input.glCategory,
      pdfPath: input.pdfPath,
      createdById: actorId,
    },
  });

  if (input.lineItems.length > 0) {
    await tx.billLineItem.createMany({
      data: input.lineItems.map((li) => ({
        billId: bill.id,
        description: li.description,
        amountCents: li.amountCents,
        type: li.type ?? "EXPENSE",
      })),
    });
  }

  await tx.billEvent.create({
    data: { billId: bill.id, type: "created", actorId, payload: eventPayload },
  });

  return bill;
}

async function submitBillInner(
  tx: Tx,
  billId: string,
  actorId: string,
): Promise<Bill> {
  const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

  if (bill.status !== "DRAFT") {
    throw new InvalidTransitionError(
      bill.status as BillStatus,
      "PENDING_APPROVAL",
    );
  }

  const now = new Date();

  if (requiresApproval(bill.amountCents)) {
    const updated = await tx.bill.update({
      where: { id: billId },
      data: { status: "PENDING_APPROVAL", submittedAt: now },
    });
    await tx.billEvent.create({
      data: {
        billId,
        type: "submitted",
        actorId,
        payload: { toStatus: "PENDING_APPROVAL" },
      },
    });
    return updated;
  } else {
    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        status: "APPROVED",
        submittedAt: now,
        approvedAt: now,
        approvedById: actorId,
      },
    });
    await tx.billEvent.createMany({
      data: [
        {
          billId,
          type: "submitted",
          actorId,
          payload: { toStatus: "APPROVED" },
        },
        {
          billId,
          type: "approved",
          actorId,
          payload: {
            fromStatus: "DRAFT",
            toStatus: "APPROVED",
            autoApproved: "true",
          },
        },
      ],
    });
    return updated;
  }
}

async function createScheduledBillFromTemplateInner(
  tx: Tx,
  template: TemplateWithVendorAndLineItems,
  payDate: Date,
  actorId: string,
): Promise<Bill> {
  const now = new Date();
  const requiresApproval = template.requireApprovalPerInstance;

  const bill = await tx.bill.create({
    data: {
      vendorId: template.vendorId,
      amountCents: template.amountCents,
      currency: "USD",
      issueDate: now,
      dueDate: payDate,
      status: requiresApproval ? "PENDING_APPROVAL" : "SCHEDULED",
      memo: template.memo ?? undefined,
      glCategory: template.glCategory ?? undefined,
      submittedAt: now,
      approvedAt: requiresApproval ? null : now,
      approvedById: requiresApproval ? null : actorId,
      // Planned schedule is set at generation regardless of approval state, so
      // an approver sees when the bill will pay; on approval the bill flips
      // straight to SCHEDULED (see approveBill).
      scheduledPayDate: payDate,
      scheduledMethod: template.vendor.paymentMethod,
      createdById: actorId,
      recurringTemplateId: template.id,
    },
  });

  if (template.lineItems.length > 0) {
    await tx.billLineItem.createMany({
      data: template.lineItems.map((li) => ({
        billId: bill.id,
        description: li.description,
        amountCents: li.amountCents,
        type: "EXPENSE" as const,
      })),
    });
  }

  type EventRow = {
    billId: string;
    type: string;
    actorId: string;
    payload: Record<string, string>;
  };
  const events: EventRow[] = [
    {
      billId: bill.id,
      type: "created",
      actorId,
      payload: {
        source: "recurring",
        templateId: template.id,
        autoApproved: requiresApproval ? "false" : "true",
      },
    },
  ];

  if (requiresApproval) {
    events.push({
      billId: bill.id,
      type: "submitted",
      actorId,
      payload: { toStatus: "PENDING_APPROVAL" },
    });
  } else {
    events.push({
      billId: bill.id,
      type: "scheduled",
      actorId,
      payload: {
        payDate: payDate.toISOString(),
        method: template.vendor.paymentMethod,
      },
    });
  }

  await tx.billEvent.createMany({ data: events });

  return bill;
}

// ─── Public exports ───────────────────────────────────────────────────────────

export async function createBill(
  input: CreateBillInput,
  actorId: string,
): Promise<Bill> {
  return db.$transaction((tx) => createBillInner(tx, input, actorId));
}

export async function updateBill(
  input: UpdateBillInput,
  actorId: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: input.id } });

    if (bill.status !== "DRAFT") {
      throw new InvalidTransitionError(bill.status as BillStatus, "DRAFT");
    }

    const changedFields: { [key: string]: string } = {};
    if (input.amountCents !== undefined)
      changedFields.amountCents = String(input.amountCents);
    if (input.vendorId !== undefined) changedFields.vendorId = input.vendorId;
    if (input.dueDate !== undefined)
      changedFields.dueDate = input.dueDate.toISOString();
    if (input.issueDate !== undefined)
      changedFields.issueDate = input.issueDate.toISOString();
    if (input.memo !== undefined) changedFields.memo = input.memo;
    if (input.glCategory !== undefined)
      changedFields.glCategory = input.glCategory;
    if (input.invoiceNumber !== undefined)
      changedFields.invoiceNumber = input.invoiceNumber;

    const updated = await tx.bill.update({
      where: { id: input.id },
      data: {
        ...(input.vendorId !== undefined && { vendorId: input.vendorId }),
        ...(input.invoiceNumber !== undefined && {
          invoiceNumber: input.invoiceNumber,
        }),
        ...(input.amountCents !== undefined && {
          amountCents: input.amountCents,
        }),
        ...(input.issueDate !== undefined && { issueDate: input.issueDate }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.memo !== undefined && { memo: input.memo }),
        ...(input.glCategory !== undefined && { glCategory: input.glCategory }),
      },
    });

    await tx.billEvent.create({
      data: {
        billId: bill.id,
        type: "edited",
        actorId,
        payload: changedFields,
      },
    });

    return updated;
  });
}

export async function submitBill(
  billId: string,
  actorId: string,
): Promise<Bill> {
  return db.$transaction((tx) => submitBillInner(tx, billId, actorId));
}

export async function createAndSubmitBill(
  input: CreateBillInput,
  actorId: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await createBillInner(tx, input, actorId);
    return submitBillInner(tx, bill.id, actorId);
  });
}

export async function approveBill(
  billId: string,
  actorId: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== "PENDING_APPROVAL") {
      throw new InvalidTransitionError(bill.status as BillStatus, "APPROVED");
    }

    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (actor.role !== "APPROVER") {
      throw new UnauthorizedError("approve");
    }

    // Recurring bills with a pre-set schedule (populated at template
    // generation) skip the manual schedule step on approval.
    const isPreScheduledRecurring =
      bill.recurringTemplateId !== null &&
      bill.scheduledPayDate !== null &&
      bill.scheduledMethod !== null;

    const now = new Date();
    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        status: isPreScheduledRecurring ? "SCHEDULED" : "APPROVED",
        approvedAt: now,
        approvedById: actorId,
      },
    });

    const events: Array<{
      billId: string;
      type: string;
      actorId: string;
      payload: Record<string, string>;
    }> = [
      {
        billId,
        type: "approved",
        actorId,
        payload: {
          fromStatus: "PENDING_APPROVAL",
          toStatus: isPreScheduledRecurring ? "SCHEDULED" : "APPROVED",
        },
      },
    ];

    if (isPreScheduledRecurring) {
      events.push({
        billId,
        type: "scheduled",
        actorId,
        payload: {
          payDate: bill.scheduledPayDate!.toISOString(),
          method: bill.scheduledMethod!,
        },
      });
    }

    await tx.billEvent.createMany({ data: events });

    return updated;
  });
}

export async function rejectBill(
  billId: string,
  actorId: string,
  reason: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== "PENDING_APPROVAL") {
      throw new InvalidTransitionError(bill.status as BillStatus, "REJECTED");
    }

    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (actor.role !== "APPROVER") {
      throw new UnauthorizedError("reject");
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
    });

    await tx.billEvent.create({
      data: { billId, type: "rejected", actorId, payload: { reason } },
    });

    return updated;
  });
}

export async function scheduleBill(
  billId: string,
  actorId: string,
  payDate: Date,
  method: PaymentMethod,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== "APPROVED") {
      throw new InvalidTransitionError(bill.status as BillStatus, "SCHEDULED");
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        status: "SCHEDULED",
        scheduledPayDate: payDate,
        scheduledMethod: method,
      },
    });

    await tx.billEvent.create({
      data: {
        billId,
        type: "scheduled",
        actorId,
        payload: { payDate: payDate.toISOString(), method },
      },
    });

    return updated;
  });
}

async function payBillInner(
  tx: Tx,
  billId: string,
  actorId: string,
): Promise<Bill> {
  const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

  if (bill.status !== "SCHEDULED") {
    throw new InvalidTransitionError(bill.status as BillStatus, "PAID");
  }

  const random6 = Math.random().toString(36).slice(2, 8).toUpperCase();
  const confirmation = `SETTLE-${Date.now()}-${random6}`;

  const updated = await tx.bill.update({
    where: { id: billId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentConfirmation: confirmation,
    },
  });

  await tx.billEvent.create({
    data: { billId, type: "paid", actorId, payload: { confirmation } },
  });

  return updated;
}

export async function payBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction((tx) => payBillInner(tx, billId, actorId));
}

export async function listBills(
  input: ListBillsInput,
  actorId: string,
  actorRole: string,
): Promise<BillWithVendor[]> {
  if (input.needsMyApproval && actorRole !== "APPROVER") return [];

  const rows = await db.bill.findMany({
    where: {
      ...(input.needsMyApproval
        ? { status: "PENDING_APPROVAL" }
        : input.status
          ? { status: input.status }
          : {}),
      ...(input.dueBefore ? { dueDate: { lte: input.dueBefore } } : {}),
      ...(input.search
        ? {
            OR: [
              {
                invoiceNumber: { contains: input.search, mode: "insensitive" },
              },
              {
                vendor: {
                  name: { contains: input.search, mode: "insensitive" },
                },
              },
              { memo: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
    },
    include: { vendor: true },
    orderBy: { dueDate: "asc" },
  });
  // Prisma 7's @ts-nocheck generated files lose the `include` type — cast explicitly
  return rows as unknown as BillWithVendor[];
}

export async function getBill(billId: string): Promise<BillWithRelations> {
  const row = await db.bill.findUniqueOrThrow({
    where: { id: billId },
    include: {
      vendor: true,
      lineItems: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return row as unknown as BillWithRelations;
}

export async function createManyBills(
  inputs: CreateBillInput[],
  actorId: string,
): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    for (const input of inputs) {
      await createBillInner(tx, input, actorId, { source: "csv" });
    }
    return { created: inputs.length };
  });
}

export async function createScheduledBillFromTemplate(
  template: TemplateWithVendorAndLineItems,
  payDate: Date,
  actorId: string,
): Promise<Bill> {
  return db.$transaction((tx) =>
    createScheduledBillFromTemplateInner(tx, template, payDate, actorId),
  );
}
