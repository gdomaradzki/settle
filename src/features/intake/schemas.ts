import { z } from "zod";
import type { CreateBillInput } from "@/features/bills/schemas";

// ─── CSV bulk-upload ──────────────────────────────────────────────────────────

function normalizeAmount(raw: string): number {
  const cleaned = (raw ?? "").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num <= 0)
    throw new Error("Must be a positive number");
  return Math.round(num * 100);
}

function normalizeOptionalAmount(raw: string | undefined): number | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const cleaned = raw.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) throw new Error("Must be a valid number");
  return Math.round(num * 100);
}

export const csvRowSchema = z.object({
  vendor_name: z.string().min(1, "Vendor name is required"),
  invoice_number: z.string().optional(),
  amount: z.string().transform((raw) => normalizeAmount(raw)),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be ISO format (YYYY-MM-DD)"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be ISO format (YYYY-MM-DD)"),
  memo: z.string().optional(),
  gl_category: z.string().optional(),
  line_description: z.string().min(1, "Line description is required"),
  line_amount: z.string().optional().transform(normalizeOptionalAmount),
  line_type: z.preprocess(
    (v) => (v === "" || v == null ? "EXPENSE" : v),
    z.enum(["EXPENSE", "ITEM"]),
  ),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export type ParsedRow = {
  raw: Record<string, string>;
  status: "valid" | "invalid";
  errors: string[];
  resolved: CreateBillInput | null;
};

export function parseCsvRow(
  raw: Record<string, string>,
  vendors: { id: string; name: string }[],
): ParsedRow {
  const result = csvRowSchema.safeParse(raw);
  const errors: string[] = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.join(".");
      errors.push(field ? `${field}: ${issue.message}` : issue.message);
    }
    return { raw, status: "invalid", errors, resolved: null };
  }

  const parsed = result.data;
  const vendorMap = new Map(vendors.map((v) => [v.name.toLowerCase(), v]));
  const vendor = vendorMap.get(parsed.vendor_name.toLowerCase());

  if (!vendor) {
    errors.push(
      `Vendor "${parsed.vendor_name}" not found. Create it first, then retry.`,
    );
    return { raw, status: "invalid", errors, resolved: null };
  }

  const lineAmount = parsed.line_amount ?? parsed.amount;

  return {
    raw,
    status: "valid",
    errors: [],
    resolved: {
      vendorId: vendor.id,
      invoiceNumber: parsed.invoice_number || undefined,
      amountCents: parsed.amount,
      issueDate: new Date(parsed.issue_date),
      dueDate: new Date(parsed.due_date),
      memo: parsed.memo || undefined,
      glCategory: parsed.gl_category || undefined,
      lineItems: [
        {
          description: parsed.line_description,
          amountCents: lineAmount,
          type: parsed.line_type,
        },
      ],
    },
  };
}

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
      type: z.enum(["EXPENSE", "ITEM"]),
    }),
  ),
});
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;

export const billFormSchema = z
  .object({
    vendorId: z.string().min(1, "Pick or create a vendor"),
    invoiceNumber: z.string().optional(),
    amountCents: z.number().int().positive("Amount must be greater than zero"),
    issueDate: z.date(),
    dueDate: z.date(),
    memo: z.string().optional(),
    glCategory: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string().min(1, "Description required"),
          amountCents: z.number().int().nonnegative(),
          type: z.enum(["EXPENSE", "ITEM"]),
        }),
      )
      .min(1, "Add at least one line item"),
  })
  .refine(
    (data) =>
      data.lineItems.reduce((s, li) => s + li.amountCents, 0) ===
      data.amountCents,
    { message: "Line items must sum to the bill amount", path: ["lineItems"] },
  )
  .refine((data) => data.dueDate >= data.issueDate, {
    message: "Due date cannot be before the issue date",
    path: ["dueDate"],
  });
export type BillFormValues = z.infer<typeof billFormSchema>;
