# Change: add-csv-bulk-upload

## Why

The intake flow currently supports two paths — manual form entry and PDF upload with LLM extraction. Real finance teams often have dozens of bills arriving per month in a spreadsheet export from a vendor portal, or hand-maintained in Excel. Asking them to re-enter each one manually is painful. CSV bulk upload closes that gap and rounds out the product's "three intake paths" story.

This change ships a CSV upload flow: drop a CSV, see a preview table with per-row validation, confirm, and all rows land as DRAFT bills in one batch.

## What Changes

- **ADDED** `src/app/bills/upload-csv/page.tsx` — the route for CSV upload.
- **ADDED** `src/features/intake/components/csv-uploader.tsx` — dropzone that accepts a CSV file and parses it client-side with papaparse.
- **ADDED** `src/features/intake/components/csv-preview-table.tsx` — shows parsed rows with per-row validation status (valid / invalid with field-level errors).
- **ADDED** `src/features/intake/schemas.ts` — extends with `CsvRowSchema` for row-level zod validation.
- **ADDED** `src/features/bills/bill-service.ts` — `createManyBills(inputs, actorId)` that inserts multiple bills in one transaction, each with a `created` BillEvent.
- **ADDED** `src/features/bills/bill-router.ts` — `createMany` mutation wrapping the service.
- **ADDED** a link from the inbox toolbar ("+ Upload CSV") next to the existing "+ New bill" button.
- **ADDED** `papaparse` and `@types/papaparse` dependencies.
- **ADDED** a sample CSV file at `public/samples/bills-sample.csv` for demo use.

## Impact

- Third intake path complete. The product now handles manual, PDF upload, and CSV bulk intake — matching real AP teams' workflows.
- No schema changes. CSV rows are just regular `Bill` records in DRAFT status.
- Existing intake paths unchanged.
- Creates a natural follow-on demo moment: "here's how a finance team onboards 20 bills from a vendor export in one click."

## Success criteria

- `/bills/upload-csv` renders a page with a CSV dropzone and a template download link.
- Dropping a valid CSV parses it client-side and displays a preview table with one row per parsed bill.
- Each row in the preview shows validation status (valid / invalid). Invalid rows display field-level error messages inline.
- Vendors are matched by name (case-insensitive); unmatched vendor names surface as a specific error type on the row ("Vendor 'Acme' not found — create it first").
- A "Confirm and import N bills" button is enabled only when every row is valid.
- Clicking confirm calls `bill.createMany` with the full row set; the server creates all bills in a single transaction, each with a `created` BillEvent.
- On success, the user is navigated to the inbox with a toast noting "N bills imported."
- A sample CSV exists at `public/samples/bills-sample.csv` demonstrating the expected columns; a "Download template" link on the upload page points to it.
- `npm run build` passes. Vercel deploy works.
