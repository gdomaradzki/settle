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
  lineItems: z.array(templateLineItemInput).min(1),
});
export type CreateTemplateInput = z.infer<typeof createTemplateInput>;
