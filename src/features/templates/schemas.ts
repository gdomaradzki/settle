import { z } from "zod";

const templateLineItemInput = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
});

export const createTemplateInput = z.object({
  vendorId: z.string().min(1),
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentDayOfMonth: z.number().int().min(1).max(28),
  memo: z.string().optional(),
  glCategory: z.string().optional(),
  endsAt: z.date().optional(),
  maxOccurrences: z.number().int().positive().optional(),
  requireApprovalPerInstance: z.boolean().optional(),
  lineItems: z.array(templateLineItemInput).min(1),
});
export type CreateTemplateInput = z.infer<typeof createTemplateInput>;

// Update intentionally omits vendorId and paymentDayOfMonth — those are
// immutable once a series exists (matches Ramp's "frequency immutable"
// rule and avoids mid-series pay-day or vendor switches).
export const updateTemplateInput = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  memo: z.string().optional(),
  glCategory: z.string().optional(),
  endsAt: z.date().optional(),
  maxOccurrences: z.number().int().positive().optional(),
  requireApprovalPerInstance: z.boolean().optional(),
  lineItems: z.array(templateLineItemInput).min(1),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateInput>;
