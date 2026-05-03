import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type {
  BillTemplate,
  BillTemplateLineItem,
  Vendor,
} from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  createScheduledBillFromTemplate,
  type TemplateWithVendorAndLineItems,
} from "@/features/bills/bill-service";
import type { CreateTemplateInput, UpdateTemplateInput } from "./schemas";

export type TemplateWithVendor = BillTemplate & {
  vendor: Vendor;
  lineItems: BillTemplateLineItem[];
};

export class DuplicateTemplateInstanceError extends Error {
  constructor() {
    super("An instance for this template and due date already exists.");
    this.name = "DuplicateTemplateInstanceError";
  }
}

export async function createTemplate(
  input: CreateTemplateInput,
  actorId: string,
): Promise<BillTemplate> {
  return db.billTemplate.create({
    data: {
      vendorId: input.vendorId,
      description: input.description,
      amountCents: input.amountCents,
      paymentDayOfMonth: input.paymentDayOfMonth,
      memo: input.memo ?? null,
      glCategory: input.glCategory ?? null,
      endsAt: input.endsAt ?? null,
      maxOccurrences: input.maxOccurrences ?? null,
      requireApprovalPerInstance: input.requireApprovalPerInstance ?? false,
      createdById: actorId,
      lineItems: {
        createMany: {
          data: input.lineItems.map((li) => ({
            description: li.description,
            amountCents: li.amountCents,
          })),
        },
      },
    },
  });
}

export async function listTemplates(): Promise<TemplateWithVendor[]> {
  const rows = await db.billTemplate.findMany({
    include: { vendor: true, lineItems: true },
    orderBy: { createdAt: "desc" },
  });
  return rows as unknown as TemplateWithVendor[];
}

export async function getTemplate(id: string): Promise<
  TemplateWithVendor & {
    bills: {
      id: string;
      dueDate: Date;
      status: string;
    }[];
  }
> {
  const row = await db.billTemplate.findUniqueOrThrow({
    where: { id },
    include: {
      vendor: true,
      lineItems: true,
      bills: {
        select: { id: true, dueDate: true, status: true },
        orderBy: { dueDate: "desc" },
      },
    },
  });
  return row as unknown as TemplateWithVendor & {
    bills: { id: string; dueDate: Date; status: string }[];
  };
}

export async function cancelTemplate(
  id: string,
): Promise<BillTemplate> {
  return db.billTemplate.update({
    where: { id },
    data: { cancelledAt: new Date() },
  });
}

// Edits apply to bills generated AFTER this call — past bills carry their
// own copy of fields/line items and are unaffected.
export async function updateTemplate(
  input: UpdateTemplateInput,
): Promise<BillTemplate> {
  return db.$transaction(async (tx) => {
    const updated = await tx.billTemplate.update({
      where: { id: input.id },
      data: {
        description: input.description,
        amountCents: input.amountCents,
        memo: input.memo ?? null,
        glCategory: input.glCategory ?? null,
        endsAt: input.endsAt ?? null,
        maxOccurrences: input.maxOccurrences ?? null,
        requireApprovalPerInstance: input.requireApprovalPerInstance ?? false,
      },
    });

    // Replace line items wholesale. Existing Bill.lineItems rows are on a
    // separate table and remain attached to their bills.
    await tx.billTemplateLineItem.deleteMany({ where: { templateId: input.id } });
    await tx.billTemplateLineItem.createMany({
      data: input.lineItems.map((li) => ({
        templateId: input.id,
        description: li.description,
        amountCents: li.amountCents,
      })),
    });

    return updated;
  });
}

export async function runGenerationForTemplate(
  id: string,
  actorId: string,
): Promise<{ billId: string }> {
  const template = await db.billTemplate.findUniqueOrThrow({
    where: { id },
    include: { vendor: true, lineItems: true },
  });

  const now = new Date();
  const payDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), template.paymentDayOfMonth),
  );

  try {
    const bill = await createScheduledBillFromTemplate(
      template as unknown as TemplateWithVendorAndLineItems,
      payDate,
      actorId,
    );
    return { billId: bill.id };
  } catch (e) {
    const isUniqueViolation =
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") ||
      (e instanceof Error && e.message.includes("Unique constraint failed"));
    if (isUniqueViolation) {
      throw new DuplicateTemplateInstanceError();
    }
    throw e;
  }
}
