# Tasks: add-csv-bulk-upload

## Dependencies

- [x] Install `papaparse` and `@types/papaparse`.

## Sample CSV

- [x] Create `public/samples/bills-sample.csv` with 5-6 rows matching the seeded vendors, covering edge cases (formatted amounts, missing `line_amount`, `line_type = ITEM`).

## Schemas

- [x] Extend `src/features/intake/schemas.ts`:
  - `CsvRowSchema`: zod schema matching the CSV column set.
  - Amount-normalization helper that strips `$` and `,` before parsing.
  - Exports `type CsvRow`, `type ParsedRow`, and `parseCsvRow(raw, vendors): ParsedRow` helper.

## Service — batch create

- [x] Add `createManyBills(inputs, actorId)` to `src/features/bills/bill-service.ts`:
  - Wraps all inserts in a single `db.$transaction`.
  - For each input: creates `Bill` (with line items) and a `created` `BillEvent` with `payload: { source: 'csv' }`.
  - Returns `{ created: number }`.

## Router — batch mutation

- [x] Add `createMany` mutation to `src/features/bills/bill-router.ts`:
  - Input: `z.array(createBillInput).min(1).max(100)`.
  - Calls `createManyBills(input, ctx.user.id)`.

## Upload page

- [x] Create `src/app/bills/upload-csv/page.tsx`.

## CSV uploader component

- [x] Create `src/features/intake/components/csv-uploader.tsx`:
  - Dropzone accepting `.csv` files up to 1MB.
  - Parses with papaparse and calls `onParsed(rows)`.

## Preview table

- [x] Create `src/features/intake/components/csv-preview-table.tsx`:
  - Validates each row against `CsvRowSchema` + vendor matching.
  - Status pills, error messages, summary bar.
  - Confirm button disabled until all rows valid.
  - "Download errors" link for invalid rows.

## Upload page composition

- [x] Create `src/features/intake/components/csv-upload-page.tsx`:
  - Three states: idle (dropzone + template link), preview (preview table), submitting.
  - Calls `trpc.bill.createMany`, navigates to `/bills` on success with toast.

## Inbox toolbar button

- [x] Added secondary "+ Upload CSV" button to `src/app/bills/page.tsx` next to "+ New bill".

## Verification

- [x] `npm run build` passes.
- [x] Navigate to `/bills/upload-csv`:
  - Upload dropzone is visible.
  - "Download template" link downloads `/samples/bills-sample.csv`.
- [x] Drop the sample CSV:
  - Preview table renders with rows, all marked Valid.
  - Amounts formatted as USD, vendors resolved to seeded vendor names.
  - Confirm button enabled.
- [x] Click "Import N bills":
  - Toast "N bills imported."
  - Browser navigates to `/bills`.
  - Inbox shows new DRAFT bills.
  - Each new bill shows a timeline entry with source: csv.
- [x] Hand-edit a CSV to have a row with a non-existent vendor name (e.g., "Phantom Corp"):
  - Drop it. Preview shows that row as Invalid with a clear "Vendor not found" message.
  - Confirm button is disabled.
- [x] Hand-edit a CSV to have a malformed date (e.g., "2026/04/15" instead of `2026-04-15`):
  - Drop it. Preview shows that row as Invalid with a date-format error.
- [x] Upload a CSV where an amount is formatted as `$12,500.00`:
  - Amount parses correctly.
- [x] Deploy to Vercel. Repeat the sample-CSV flow on the live URL.

## Definition of done

- All checkboxes above are ticked.
- The third intake path exists, works, and is navigable from the inbox.
- Sample CSV available and downloadable.
- Invalid rows surface actionable errors before the user commits.
- `openspec validate --strict add-csv-bulk-upload` passes.
