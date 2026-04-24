import 'server-only';
import type { Bill } from '@/generated/prisma/client';
import type { BillStatus, PaymentMethod } from '@/generated/prisma/enums';
import { db } from '@/server/db';
import { requiresApproval } from '@/features/approvals/approval-rules';
import { InvalidTransitionError, UnauthorizedError } from './errors';
import type { CreateBillInput, UpdateBillInput, ListBillsInput } from './schemas';

export async function createBill(input: CreateBillInput, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.create({
      data: {
        vendorId: input.vendorId,
        invoiceNumber: input.invoiceNumber,
        amountCents: input.amountCents,
        currency: 'USD',
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: 'DRAFT',
        memo: input.memo,
        glCategory: input.glCategory,
        createdById: actorId,
      },
    });

    if (input.lineItems.length > 0) {
      await tx.billLineItem.createMany({
        data: input.lineItems.map((li) => ({
          billId: bill.id,
          description: li.description,
          amountCents: li.amountCents,
          type: li.type ?? 'EXPENSE',
        })),
      });
    }

    await tx.billEvent.create({
      data: { billId: bill.id, type: 'created', actorId },
    });

    return bill;
  });
}

export async function updateBill(input: UpdateBillInput, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: input.id } });

    if (bill.status !== 'DRAFT') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'DRAFT');
    }

    const changedFields: { [key: string]: string } = {};
    if (input.amountCents !== undefined) changedFields.amountCents = String(input.amountCents);
    if (input.vendorId !== undefined) changedFields.vendorId = input.vendorId;
    if (input.dueDate !== undefined) changedFields.dueDate = input.dueDate.toISOString();
    if (input.issueDate !== undefined) changedFields.issueDate = input.issueDate.toISOString();
    if (input.memo !== undefined) changedFields.memo = input.memo;
    if (input.glCategory !== undefined) changedFields.glCategory = input.glCategory;
    if (input.invoiceNumber !== undefined) changedFields.invoiceNumber = input.invoiceNumber;

    const updated = await tx.bill.update({
      where: { id: input.id },
      data: {
        ...(input.vendorId !== undefined && { vendorId: input.vendorId }),
        ...(input.invoiceNumber !== undefined && { invoiceNumber: input.invoiceNumber }),
        ...(input.amountCents !== undefined && { amountCents: input.amountCents }),
        ...(input.issueDate !== undefined && { issueDate: input.issueDate }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.memo !== undefined && { memo: input.memo }),
        ...(input.glCategory !== undefined && { glCategory: input.glCategory }),
      },
    });

    await tx.billEvent.create({
      data: { billId: bill.id, type: 'edited', actorId, payload: changedFields },
    });

    return updated;
  });
}

export async function submitBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== 'DRAFT') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'PENDING_APPROVAL');
    }

    const now = new Date();

    if (requiresApproval(bill.amountCents)) {
      const updated = await tx.bill.update({
        where: { id: billId },
        data: { status: 'PENDING_APPROVAL', submittedAt: now },
      });
      await tx.billEvent.create({
        data: { billId, type: 'submitted', actorId, payload: { toStatus: 'PENDING_APPROVAL' } },
      });
      return updated;
    } else {
      const updated = await tx.bill.update({
        where: { id: billId },
        data: { status: 'APPROVED', submittedAt: now, approvedAt: now, approvedById: actorId },
      });
      await tx.billEvent.createMany({
        data: [
          { billId, type: 'submitted', actorId, payload: { toStatus: 'APPROVED' } },
          { billId, type: 'approved', actorId, payload: { fromStatus: 'DRAFT', toStatus: 'APPROVED', autoApproved: 'true' } },
        ],
      });
      return updated;
    }
  });
}

export async function approveBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== 'PENDING_APPROVAL') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'APPROVED');
    }

    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (actor.role !== 'APPROVER') {
      throw new UnauthorizedError('approve');
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actorId },
    });

    await tx.billEvent.create({
      data: { billId, type: 'approved', actorId, payload: { fromStatus: 'PENDING_APPROVAL', toStatus: 'APPROVED' } },
    });

    return updated;
  });
}

export async function rejectBill(billId: string, actorId: string, reason: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== 'PENDING_APPROVAL') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'REJECTED');
    }

    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (actor.role !== 'APPROVER') {
      throw new UnauthorizedError('reject');
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedReason: reason },
    });

    await tx.billEvent.create({
      data: { billId, type: 'rejected', actorId, payload: { reason } },
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

    if (bill.status !== 'APPROVED') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'SCHEDULED');
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: { status: 'SCHEDULED', scheduledPayDate: payDate, scheduledMethod: method },
    });

    await tx.billEvent.create({
      data: { billId, type: 'scheduled', actorId, payload: { payDate: payDate.toISOString(), method } },
    });

    return updated;
  });
}

export async function payBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    if (bill.status !== 'SCHEDULED') {
      throw new InvalidTransitionError(bill.status as BillStatus, 'PAID');
    }

    const random6 = Math.random().toString(36).slice(2, 8).toUpperCase();
    const confirmation = `SETTLE-${Date.now()}-${random6}`;

    const updated = await tx.bill.update({
      where: { id: billId },
      data: { status: 'PAID', paidAt: new Date(), paymentConfirmation: confirmation },
    });

    await tx.billEvent.create({
      data: { billId, type: 'paid', actorId, payload: { confirmation } },
    });

    return updated;
  });
}

export async function listBills(input: ListBillsInput, actorId: string) {
  if (input.needsMyApproval) {
    const actor = await db.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.role !== 'APPROVER') return [];
  }

  return db.bill.findMany({
    where: {
      ...(input.needsMyApproval
        ? { status: 'PENDING_APPROVAL' }
        : input.status
          ? { status: input.status }
          : {}),
      ...(input.dueBefore ? { dueDate: { lte: input.dueBefore } } : {}),
      ...(input.search
        ? {
            OR: [
              { invoiceNumber: { contains: input.search, mode: 'insensitive' } },
              { vendor: { name: { contains: input.search, mode: 'insensitive' } } },
              { memo: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
  });
}

export async function getBill(billId: string) {
  return db.bill.findUniqueOrThrow({
    where: { id: billId },
    include: {
      vendor: true,
      lineItems: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
}
