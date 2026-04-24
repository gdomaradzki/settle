# intake — Delta Spec

## ADDED Requirements

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

#### Scenario: Canned fallback triggers when no key is set

- **GIVEN** `ANTHROPIC_API_KEY` is unset
- **AND** the user uploads a file named `aws-invoice.pdf` matching a canned entry
- **WHEN** the extraction endpoint is called
- **THEN** the returned extraction matches the canned entry for `aws-invoice.pdf`
- **AND** no Anthropic API request was made

#### Scenario: Unknown filenames return sensible empty defaults

- **GIVEN** `ANTHROPIC_API_KEY` is unset
- **AND** the user uploads a file named `random.pdf` with no canned entry
- **WHEN** extraction runs
- **THEN** the returned extraction contains empty strings for `vendorName` and `invoiceNumber`
- **AND** sensible date defaults (today for issue, +30 days for due)
- **AND** an empty line items array

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
