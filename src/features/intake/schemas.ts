import { z } from 'zod';

export const invoiceExtractionSchema = z.object({
  vendorName: z.string(),
  invoiceNumber: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineItems: z.array(
    z.object({
      description: z.string(),
      amountCents: z.number().int().nonnegative(),
      type: z.enum(['EXPENSE', 'ITEM']),
    }),
  ),
});
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;

export const billFormSchema = z
  .object({
    vendorId: z.string().min(1, 'Pick or create a vendor'),
    invoiceNumber: z.string().optional(),
    amountCents: z.number().int().positive('Amount must be greater than zero'),
    issueDate: z.date(),
    dueDate: z.date(),
    memo: z.string().optional(),
    glCategory: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string().min(1, 'Description required'),
          amountCents: z.number().int().nonnegative(),
          type: z.enum(['EXPENSE', 'ITEM']),
        }),
      )
      .min(1, 'Add at least one line item'),
  })
  .refine(
    (data) => data.lineItems.reduce((s, li) => s + li.amountCents, 0) === data.amountCents,
    { message: 'Line items must sum to the bill amount', path: ['lineItems'] },
  )
  .refine((data) => data.dueDate >= data.issueDate, {
    message: 'Due date cannot be before the issue date',
    path: ['dueDate'],
  });
export type BillFormValues = z.infer<typeof billFormSchema>;
