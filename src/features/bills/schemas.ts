import { z } from "zod";

const lineItemInput = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(["EXPENSE", "ITEM"]).optional(),
});

export const createBillInput = z.object({
  vendorId: z.string(),
  invoiceNumber: z.string().optional(),
  amountCents: z.number().int().positive(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  memo: z.string().optional(),
  glCategory: z.string().optional(),
  pdfPath: z.string().optional(),
  lineItems: z.array(lineItemInput),
});
export type CreateBillInput = z.infer<typeof createBillInput>;

export const updateBillInput = z.object({
  id: z.string(),
  vendorId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  amountCents: z.number().int().positive().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  memo: z.string().optional(),
  glCategory: z.string().optional(),
  lineItems: z.array(lineItemInput).optional(),
});
export type UpdateBillInput = z.infer<typeof updateBillInput>;

export const rejectInput = z.object({
  billId: z.string(),
  reason: z.string().min(1),
});

export const scheduleInput = z.object({
  billId: z.string(),
  payDate: z.coerce.date(),
  method: z.enum(["ACH", "CHECK"]),
});

export const listBillsInput = z.object({
  status: z
    .enum([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "SCHEDULED",
      "PAID",
      "REJECTED",
    ])
    .optional(),
  dueBefore: z.coerce.date().optional(),
  needsMyApproval: z.boolean().optional(),
  search: z.string().optional(),
  vendorId: z.string().optional(),
});
export type ListBillsInput = z.infer<typeof listBillsInput>;
