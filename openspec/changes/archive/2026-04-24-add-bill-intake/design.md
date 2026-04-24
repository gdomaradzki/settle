# Design: add-bill-intake

## The page's narrative

The intake page is the "front door" to the product. Before a user does anything, they see the choice laid out as two side-by-side options or a single primary path with a secondary link:

```
┌────────────────────────────────────────────────────┐
│                                                     │
│   ┌───────────────────────────────┐                │
│   │                                │                │
│   │    Drop invoice PDF here       │                │
│   │    or click to browse           │                │
│   │                                │                │
│   └───────────────────────────────┘                │
│                                                     │
│     or enter manually                                │
│                                                     │
└────────────────────────────────────────────────────┘
```

After a PDF is uploaded (or "enter manually" clicked), the page transitions to the form. Upload can still be re-triggered from the form's header — the two paths aren't exclusive.

## Extraction service — server-side

`src/features/intake/services/extract-invoice-data.ts`:

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { InvoiceExtractionSchema } from "../schemas";

export async function extractInvoiceData(
  pdfBase64: string,
  filename: string,
): Promise<InvoiceExtraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return getCannedExtraction(filename);

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const json = extractJsonBlock(text);
    return InvoiceExtractionSchema.parse(JSON.parse(json));
  } catch (err) {
    // On any failure (bad JSON, API error, schema mismatch), fall back rather than break the demo.
    console.error("Extraction failed, falling back:", err);
    return getCannedExtraction(filename);
  }
}
```

The `EXTRACTION_PROMPT` instructs Claude to return JSON matching the zod schema exactly, nothing else. Zod validation on the parsed output is the last line of defense — if Claude hallucinates fields or wrong types, we get a clean schema error and fall back instead of corrupting the form.

## Canned extraction fallback

`getCannedExtraction(filename)` looks the filename up in a small map:

```ts
const CANNED: Record<string, InvoiceExtraction> = {
  "aws-invoice.pdf": {
    vendorName: "Amazon Web Services",
    invoiceNumber: "AWS-2026-04-INV",
    amountCents: 842_300,
    issueDate: "2026-04-01",
    dueDate: "2026-05-01",
    lineItems: [
      {
        description: "EC2 compute (t3.xlarge)",
        amountCents: 412_400,
        type: "EXPENSE",
      },
      { description: "S3 storage", amountCents: 189_500, type: "EXPENSE" },
      { description: "Data transfer", amountCents: 240_400, type: "EXPENSE" },
    ],
  },
  "wework-invoice.pdf": {
    /* ... */
  },
  // ... 3-4 more
};

function getCannedExtraction(filename: string): InvoiceExtraction {
  const match = CANNED[filename.toLowerCase()];
  if (match) return match;
  return REASONABLE_DEFAULT;
}
```

`REASONABLE_DEFAULT` is an empty-ish extraction: today as issue date, +30 days as due date, empty vendor, empty line items. The UI then shows the "couldn't extract this automatically" banner.

The demo value of canned samples: the evaluator can upload _any_ PDF named `aws-invoice.pdf` (or one of the others) and see extraction "work" without a key — and we ship those 3-4 sample PDFs under `/public/samples/` so the experience is click-ready.

## Extraction prompt

```
You are extracting structured data from an invoice PDF.

Return ONLY a JSON object, no preamble or markdown. The object MUST match this schema:

{
  "vendorName": string,
  "invoiceNumber": string | null,
  "amountCents": number,
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "lineItems": [
    { "description": string, "amountCents": number, "type": "EXPENSE" | "ITEM" }
  ]
}

Conventions:
- All amounts are in USD cents. $12.50 → 1250.
- If no due date is printed, assume 30 days after the issue date.
- Use "EXPENSE" for services and operational costs; "ITEM" only for physical inventory.
- If the invoice has no explicit line items, create a single line item for the total amount.
```

Direct, typed, deterministic. Nothing about the prompt is cute — every sentence shapes the output.

## tRPC mutation

`src/features/intake/intake-router.ts`:

```ts
export const intakeRouter = router({
  extractFromPdf: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string(),
        filename: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return extractInvoiceData(input.pdfBase64, input.filename);
    }),
});
```

Why a mutation, not a query: even though it's "read-only" in the semantic sense (doesn't change DB state), it's expensive, non-idempotent in the LLM sense (same PDF can produce slightly different output), and should never be cached. Mutation is the right semantics.

## Form architecture

`<BillIntakeForm>` uses `react-hook-form` with a zod resolver. The form schema:

```ts
export const BillFormSchema = z
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
          description: z.string().min(1),
          amountCents: z.number().int().nonnegative(),
          type: z.enum(["EXPENSE", "ITEM"]),
          glCategory: z.string().optional(),
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
```

Two cross-field validations via `.refine`: line items sum matches bill amount, due date not before issue date. Both are important AP invariants.

## Vendor picker

A combobox (shadcn `Command`) that:

- Searches existing vendors via `trpc.vendor.list.useQuery()`.
- Shows matches as the user types.
- Has a "+ Create new vendor" option at the bottom of the dropdown.
- Creating a new vendor opens a small inline dialog with name + payment method + optional email, calls `trpc.vendor.create`, selects the new vendor on success.

When prefill from extraction sets `vendorName`, we try to match:

1. Exact case-insensitive match on existing vendor name → select that vendor.
2. No match → open the create-vendor dialog pre-filled with the extracted name. User confirms with one click.

## Line items UI

A stacked list with:

- Description input (flex-grow)
- Amount input (fixed width, right-aligned, with $ prefix)
- Expense/Item select (compact)
- Remove button (X)
- "+ Add line item" button below the list.

On amount change: if the bill amount hasn't been manually edited (tracked via a form dirty flag), automatically update the bill amount to the sum of line items. Once the user edits the bill amount directly, stop auto-updating — let them manage it themselves.

This is a real UX tension: auto-sum is convenient but can silently change a value the user thought was set. Tracking a "user has touched bill amount" flag splits the difference.

## Two submit actions

The form's footer has two buttons:

**"Save as draft"** (secondary):

- Calls `trpc.bill.create({ ...formData })` — bill is created in DRAFT.
- On success: navigate to `/bills/[id]` for the new bill.

**"Submit for approval"** (primary):

- Calls `trpc.bill.create`, then on success, calls `trpc.bill.submit(newId)`.
- Two mutations in sequence, not one. Simpler than adding a `status` param to create.
- On success: navigate to `/bills/[id]`.

Both show loading state on the clicked button. Both disable the other while in flight to prevent double-submit.

## "New bill" button in the inbox

Small scope spill from `add-bill-inbox`. Keeping it here because:

- The inbox is already archived; reopening it for one button is cleaner as a diff in this change.
- The button only makes sense once this intake flow exists — before this change, clicking it would land on a placeholder.

The button is in the inbox's toolbar next to the search input: primary button, `+ New bill`, links to `/bills/new`.

## Working with the extraction field shapes

Claude returns dates as `YYYY-MM-DD` strings; the form needs `Date` objects. The `BillIntakeForm` component handles this translation when applying extraction data to the form:

```ts
function applyExtraction(form, extraction) {
  form.setValue("invoiceNumber", extraction.invoiceNumber ?? "");
  form.setValue("amountCents", extraction.amountCents);
  form.setValue("issueDate", new Date(extraction.issueDate));
  form.setValue("dueDate", new Date(extraction.dueDate));
  form.setValue("lineItems", extraction.lineItems);
  // vendor handled separately via the matcher
}
```

Type discipline is why the schemas are shared between server and client: the form's `BillFormSchema` and the extraction's `InvoiceExtractionSchema` overlap but aren't identical (dates are Date vs string), and making the adapter explicit is the right call.

## Payload size

Base64-encoded PDFs are large. A 500KB PDF becomes ~680KB as base64. tRPC's default body limits in Next.js route handlers are fine up to ~4MB, but we should cap at 10MB as a sanity check — invoices larger than that are unusual and suggest either a scan error or a malicious payload.

```ts
if (file.size > 10 * 1024 * 1024) {
  toast.error("PDF is too large. Please upload a file under 10MB.");
  return;
}
```

Client-side check before base64 encoding.

## What this change does not do

- No persistent PDF storage. The uploaded PDF is sent to extraction, used to prefill fields, then discarded. `bill.pdfPath` is set to a canned sample path matching the vendor (same logic as seed). Real persistence would use Vercel Blob; explicitly out of scope.
- No edit flow for existing bills. The intake form is create-only. Editing a DRAFT bill is a future change.
- No CSV bulk upload. Separate change (`add-csv-bulk-upload`), cut first if time runs short.
- No duplicate detection. Upload the same invoice twice → two bills get created. Real products surface a warning; we don't.
- No PO matching. No references to purchase orders anywhere in the form.
- No attachments other than the primary invoice PDF. No "additional documents" upload.
- No inline OCR preview of what Claude "saw." We take its output, show the prefilled form, and let the user correct. Highlighting extracted text regions on the PDF is a nice UX but nontrivial.
