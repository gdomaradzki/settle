# intake Specification

## Purpose

The `intake` capability covers bill creation: the paths, validations, and services by which a bill enters the system. This includes manual form entry, PDF upload with LLM-driven extraction, and graceful fallback behavior when the LLM is unavailable.
## Requirements
### Requirement: The intake page offers both PDF upload and manual entry paths

The system SHALL render, at `/bills/new`, an initial screen presenting two paths: drag-and-drop (or click-to-browse) PDF upload, and an "enter manually" link that skips directly to the form. Both paths lead to the same form in the same route.

#### Scenario: User can switch to manual entry without uploading

- **GIVEN** the user has opened `/bills/new`
- **WHEN** the user clicks "enter manually"
- **THEN** the form renders with empty defaults
- **AND** the vendor combobox is focusable

### Requirement: PDF extraction uses Claude when a key is set, canned data otherwise

The system SHALL, when a PDF is uploaded to the extraction endpoint:

- If `ANTHROPIC_API_KEY` is set in the environment: call the Anthropic Messages API with the PDF as a document content block, parse the response as JSON, and validate it against `InvoiceExtractionSchema`.
- If the key is unset, or if the API call fails for any reason (network error, JSON parse failure, schema mismatch): fall back to a canned extraction looked up by filename.

The fallback SHALL never propagate a user-visible error for a failed API call. Logs are permitted; user-facing errors are not.

In addition, the system SHALL, in the same mutation, attempt to persist the uploaded PDF to Vercel Blob storage. The mutation response SHALL include both the extraction result and the resulting blob URL (or `null` if persistence failed or was skipped).

#### Scenario: Canned fallback triggers when no key is set

- **GIVEN** `ANTHROPIC_API_KEY` is unset
- **AND** the user uploads a file named `aws-invoice.pdf` matching a canned entry
- **WHEN** the extraction endpoint is called
- **THEN** the returned `extraction` matches the canned entry for `aws-invoice.pdf`
- **AND** no Anthropic API request was made

#### Scenario: Unknown filenames return sensible empty defaults

- **GIVEN** `ANTHROPIC_API_KEY` is unset
- **AND** the user uploads a file named `random.pdf` with no canned entry
- **WHEN** extraction runs
- **THEN** the returned `extraction` contains empty strings for `vendorName` and `invoiceNumber`
- **AND** sensible date defaults (today for issue, +30 days for due)
- **AND** an empty line items array

#### Scenario: Successful extraction also returns a blob URL

- **GIVEN** `ANTHROPIC_API_KEY` is set
- **AND** `BLOB_READ_WRITE_TOKEN` is set
- **WHEN** the user uploads an invoice PDF
- **THEN** the mutation response includes a non-null `pdfUrl` matching the pattern `https://<hash>.public.blob.vercel-storage.com/<name>-<random>.pdf`
- **AND** the mutation response includes the structured `extraction`

### Requirement: Uploaded PDFs are capped at 10MB client-side

The system SHALL, before encoding any uploaded file as base64 or sending it to the extraction endpoint, check its size. Files larger than 10MB SHALL be rejected with a toast error and no network request SHALL be issued.

#### Scenario: A 12MB PDF is rejected locally

- **GIVEN** the user drops a 12MB PDF onto the uploader
- **WHEN** the uploader processes the file
- **THEN** a toast error appears stating the file exceeds the 10MB limit
- **AND** no request is sent to the extraction endpoint

### Requirement: Extraction output matches the shared schema

The system SHALL define a shared `InvoiceExtractionSchema` (zod) used by both the server-side extraction service and the client-side form prefill logic. The server SHALL validate parsed output against this schema before returning; invalid output SHALL cause a fallback to canned data.

#### Scenario: A malformed Claude response falls back gracefully

- **GIVEN** `ANTHROPIC_API_KEY` is set
- **AND** Claude returns JSON missing the required `amountCents` field
- **WHEN** the server-side validation runs
- **THEN** the extraction service catches the schema error
- **AND** returns the canned extraction for that filename
- **AND** the user sees the form prefill as if the API had not been called

### Requirement: Uploaded PDFs are persisted to Vercel Blob storage

The system SHALL, when a PDF is submitted to the `extractFromPdf` mutation, attempt to upload the file to Vercel Blob using public access with a random URL suffix. Extraction and persistence SHALL run in parallel (`Promise.all`) to minimize user-perceived latency.

The resulting Blob URL SHALL be returned alongside the extraction data in the mutation response, and SHALL flow into `Bill.pdfPath` when the bill is created.

#### Scenario: Two uploads of the same filename produce distinct URLs

- **GIVEN** the user uploads `aws-invoice.pdf` once, and later uploads another file also named `aws-invoice.pdf`
- **WHEN** both extractions complete
- **THEN** the two returned `pdfUrl` values are different
- **AND** both URLs remain accessible independently (no overwrite)

### Requirement: Blob storage failure degrades gracefully

The system SHALL, on any Blob storage failure (missing token, API error, quota exceeded), return `pdfUrl = null` from the `extractFromPdf` mutation instead of throwing. The extraction response SHALL still complete normally if extraction itself succeeded. The caller SHALL treat `pdfUrl = null` identically to the pre-persistence baseline: the bill is created with `pdfPath = null`, and the detail page renders its "No PDF attached" fallback.

No user-visible error, toast, or banner SHALL appear in response to a Blob failure.

#### Scenario: Invalid Blob token still allows bill creation

- **GIVEN** `BLOB_READ_WRITE_TOKEN` is set to an invalid value
- **AND** `ANTHROPIC_API_KEY` is set and valid
- **WHEN** the user uploads a PDF
- **THEN** the extraction result is returned normally
- **AND** `pdfUrl` in the response is `null`
- **AND** when the user saves the bill, it is created with `pdfPath = null`
- **AND** no error toast is shown

### Requirement: The intake preview renders the persisted URL after extraction

The system SHALL, once the `extractFromPdf` mutation returns a non-null `pdfUrl`, switch the intake page's preview iframe from the local `blob:` URL to the persisted Blob URL. The local URL SHALL be released via `URL.revokeObjectURL` when the switch occurs.

#### Scenario: Preview matches what will be saved on the bill

- **GIVEN** the user has uploaded a PDF and extraction has completed with a non-null `pdfUrl`
- **WHEN** the intake preview iframe has finished re-rendering
- **THEN** the iframe's `src` attribute equals the `pdfUrl`
- **AND** when the bill is saved, the detail page's iframe renders from the same URL

### Requirement: CSV bulk upload is a distinct intake path

The system SHALL render at `/bills/upload-csv` a bulk intake surface that accepts a CSV file, parses it client-side with papaparse, validates each row against a shared schema, and on confirmation creates every valid row as a DRAFT bill in a single server-side batch. The intake capability SHALL treat this path as equal in standing to the existing manual and PDF paths.

#### Scenario: The CSV route renders a dropzone

- **GIVEN** the application is deployed
- **WHEN** the user opens `/bills/upload-csv`
- **THEN** the page shows a CSV dropzone and a "Download template" link
- **AND** clicking the template link downloads `/samples/bills-sample.csv`

### Requirement: CSV rows are validated per-row with field-level errors

The system SHALL validate each parsed CSV row independently against a `CsvRowSchema` (zod). Invalid rows SHALL be displayed in the preview table with inline, field-level error messages. Valid rows SHALL be displayed with a "Valid" status pill. The preview table SHALL show a summary count of valid and invalid rows above the body.

#### Scenario: A malformed date surfaces a field-level error

- **GIVEN** a CSV row has `due_date = "2026/04/15"` (slash-separated, not ISO)
- **WHEN** the file is dropped
- **THEN** the preview row for that line shows status "Invalid"
- **AND** an inline error reads that the due date must be ISO format (YYYY-MM-DD)
- **AND** the confirm button is disabled until the row is valid

### Requirement: Vendor matching is case-insensitive and does not auto-create

The system SHALL match the `vendor_name` column against existing vendor names using case-insensitive equality. If no match is found, the row SHALL be marked invalid with an error naming the missing vendor. The system SHALL NOT create new vendors during CSV import under any circumstances.

#### Scenario: An unmatched vendor name blocks that row

- **GIVEN** a CSV row has `vendor_name = "Phantom Corp"`
- **AND** no vendor with that name exists in the database
- **WHEN** the file is parsed
- **THEN** the preview row shows status "Invalid"
- **AND** an error reads "Vendor 'Phantom Corp' not found. Create it first, then retry."
- **AND** no new vendor is created in the database

### Requirement: Amount values accept common formatting

The system SHALL accept CSV amount values in any of the following forms and parse them to integer cents: plain number (`12500`), decimal (`12500.00`), formatted with commas (`12,500`), formatted with currency symbol (`$12,500.00`). Non-numeric strings SHALL be rejected with a field-level error.

#### Scenario: A formatted amount parses correctly

- **GIVEN** a CSV row has `amount = "$12,500.00"`
- **WHEN** the row is validated
- **THEN** the parsed amount equals `1_250_000` cents
- **AND** the preview table displays it as `$12,500.00`

### Requirement: CSV import creates all bills in a single transaction

The system SHALL, when the user confirms the import, invoke `bill.createMany` with all valid row inputs. The server SHALL insert every bill in a single Prisma transaction, each with a `created` `BillEvent` whose `payload` includes `{ source: "csv" }`. If any insert fails, the entire transaction SHALL be rolled back, and no bills SHALL be created.

#### Scenario: All-or-nothing semantics on batch failure

- **GIVEN** a CSV with 5 valid rows has been confirmed for import
- **AND** a foreign-key constraint is violated on the third row's insert (e.g., the vendor was deleted in another tab between parse and commit)
- **WHEN** the transaction runs
- **THEN** no bills are created in the database
- **AND** the user sees a red toast describing the failure
- **AND** the preview table remains populated so the user can retry

