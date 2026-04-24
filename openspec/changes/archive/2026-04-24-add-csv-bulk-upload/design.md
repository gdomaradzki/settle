# Design: add-csv-bulk-upload

## CSV schema

The expected column set is kept intentionally narrow. Matching every field a bill supports would produce a CSV with 15+ columns that nobody wants to edit. Instead, the CSV covers the fields a finance team realistically has in a vendor export:

- `vendor_name` — required, matched case-insensitively against existing vendors.
- `invoice_number` — optional.
- `amount` — required, accepts `$12,500.00` or `12500.00` or `12500`.
- `issue_date` — required, ISO `YYYY-MM-DD`.
- `due_date` — required, ISO `YYYY-MM-DD`.
- `memo` — optional.
- `gl_category` — optional.
- `line_description` — required; the bill's single line item description.
- `line_amount` — optional; if omitted, equals the bill amount.
- `line_type` — optional; defaults to `EXPENSE`, accepts `EXPENSE` or `ITEM`.

One row = one bill with a single line item. Multi-line bills are rare in CSV exports (they arrive that way from spreadsheet workflows), and expanding the CSV shape to support multiple line items per row requires either a nested cell format or repeated-row semantics — both are awful UX. Keep it one row, one bill, one line item.

If an evaluator wants multi-line bills, they use the manual form or PDF upload. Those paths support multiple line items natively.

## Client-side parse and validation

Papaparse runs in the browser. No server round-trip for parsing — the user sees validation results immediately.

Flow:

1. User drops file. File size validated (≤ 1MB). File extension checked (`.csv`).
2. `Papa.parse(file, { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase() })`.
3. Each parsed row runs through `CsvRowSchema` (zod).
4. Vendor names are matched against `trpc.vendor.list` loaded on the page.
5. Each row becomes a `{ row, status: 'valid' | 'invalid', errors: string[], resolved: ParsedBill | null }`.
6. Preview table renders with status pills and inline errors.

`CsvRowSchema` is permissive on input: it accepts `$12,500.00` by stripping non-numeric characters before parsing. Dates must be ISO — no date-format coercion magic that hides errors.

```ts
const CsvRowSchema = z.object({
  vendor_name: z.string().min(1),
  invoice_number: z.string().optional().or(z.literal("")),
  amount: z
    .string()
    .transform(normalizeAmount)
    .pipe(z.number().int().positive()),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().optional().or(z.literal("")),
  gl_category: z.string().optional().or(z.literal("")),
  line_description: z.string().min(1),
  line_amount: z.string().optional().transform(normalizeOptionalAmount),
  line_type: z.enum(["EXPENSE", "ITEM"]).optional().default("EXPENSE"),
});

function normalizeAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) throw new Error("Invalid amount");
  return Math.round(num * 100);
}
```

## Vendor matching

When the page loads, it pulls the full vendor list via `trpc.vendor.list`. Rows are validated against that list in memory:

```ts
const vendorByNameLower = new Map(
  vendors.map((v) => [v.name.toLowerCase(), v]),
);
const matched = vendorByNameLower.get(row.vendor_name.toLowerCase());
if (!matched) {
  errors.push(
    `Vendor "${row.vendor_name}" not found. Create it first, then retry.`,
  );
}
```

No auto-create-vendor during CSV import. If a CSV references an unknown vendor, the user must create the vendor manually first. Reasons:

1. Auto-creating mystery vendors from a CSV is how finance databases get polluted.
2. Vendors have payment methods, ACH info, mailing addresses — none of which are in a CSV shape.
3. The user experience of "your CSV created 7 phantom vendors" is a trap.

If an evaluator asks "why not auto-create?" the answer is "data hygiene."

## Preview table

Renders each parsed row. Columns:

- Status pill (Valid / Invalid)
- Vendor (resolved vendor name or the raw string in red if unmatched)
- Invoice #
- Amount (formatted as USD)
- Due date
- Line description
- Errors (expandable if more than one)

Valid rows render in default text. Invalid rows render with a subtle red-tinted background on the row. No alternating stripe colors — the red tint carries the signal.

Top of the table: a summary bar reading "N valid · M invalid" and a "Download errors as CSV" link when there are invalid rows (helps the user fix their source file).

## Server-side batch creation

`bill-service.ts` gains:

```ts
export async function createManyBills(
  inputs: CreateBillInput[],
  actorId: string,
): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    let count = 0;
    for (const input of inputs) {
      const bill = await tx.bill.create({
        data: {
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
          amountCents: input.amountCents,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          memo: input.memo,
          glCategory: input.glCategory,
          pdfPath: null, // CSV bills have no PDF
          status: "DRAFT",
          createdById: actorId,
          lineItems: {
            create: input.lineItems,
          },
        },
      });
      await tx.billEvent.create({
        data: {
          billId: bill.id,
          type: "created",
          actorId,
          payload: { source: "csv" },
        },
      });
      count++;
    }
    return { created: count };
  });
}
```

Single transaction around all inserts. If any row fails, the entire batch rolls back — better than partial success, which leaves the user wondering which half of their CSV landed.

The `payload: { source: 'csv' }` on the BillEvent lets the detail page's timeline show "Gus Silva created (from CSV)" which is nicer than the generic "created." Small detail.

## Error handling in the batch

Per-row validation happens client-side before the mutation is called, so the server should only ever see valid rows. If something slips through (Prisma-level constraint, connection drop), the mutation's `onError` surfaces a red toast with the error message.

One edge case: the user opens the page, parses a CSV, and in a second tab an APPROVER deletes a vendor referenced in the CSV. Now the CSV references a vendor that existed at parse time but doesn't exist at import time. The server's foreign-key constraint rejects the insert; transaction rolls back; user sees "Import failed: vendor X no longer exists." Rare, acceptable.

## "+ Upload CSV" button in the inbox

Next to the existing "+ New bill" button. Same style, secondary button. Click navigates to `/bills/upload-csv`.

## Sample CSV

Ship a sample at `public/samples/bills-sample.csv` with 5-6 realistic rows referencing the seeded vendors. The upload page exposes it as a "Download template" link. Evaluator can grab it, optionally edit, drop it back in — instant demo.

The sample covers edge cases:

- At least one row with `amount` as `$1,234.56` (comma + dollar sign)
- At least one row with `amount` as a plain integer
- One row with only `line_description` and no `line_amount` (demonstrates auto-fill)
- One row with `line_type = ITEM`

## What this change does not do

- No auto-creation of unknown vendors during import (deliberate; see Vendor matching section).
- No multi-line-item bills via CSV (one row = one bill, one line item).
- No incremental/partial import (either all rows succeed or none).
- No CSV templates per vendor or per organization.
- No column remapping UI. The CSV must use the exact column names specified.
- No PDF attachment per CSV row. All CSV-imported bills have `pdfPath = null`.
- No detection of duplicate imports. Dropping the same CSV twice creates duplicate bills.
- No validation that `line_amount` equals `amount` (the sum check is enforced only in the manual intake form; CSV trusts the user).
