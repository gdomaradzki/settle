# intake — Delta Spec

## ADDED Requirements

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