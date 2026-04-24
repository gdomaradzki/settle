# intake — Delta Spec

## MODIFIED Requirements

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

## ADDED Requirements

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
