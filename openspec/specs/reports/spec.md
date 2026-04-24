# reports Specification

## Purpose
TBD - created by archiving change add-ap-aging-report. Update Purpose after archive.
## Requirements
### Requirement: The AP Aging Report lives at /reports/ap-aging

The system SHALL render the Accounts Payable Aging Report at the route `/reports/ap-aging`, replacing the placeholder from the app-shell change. The page SHALL include a title "AP Aging Report" and an "as of" marker showing when the snapshot was computed.

#### Scenario: The report route renders with an as-of date

- **GIVEN** the application is deployed
- **WHEN** the user opens `/reports/ap-aging`
- **THEN** the page heading reads "AP Aging Report"
- **AND** a secondary element shows "as of" followed by today's date formatted as a readable string

### Requirement: Bills are bucketed by days past due

The system SHALL classify each outstanding bill into exactly one of four buckets based on `dueDate` relative to the current date. A bill is `current` when `dueDate` is today or later. A bill is `d1to30` when `dueDate` is 1 to 30 days in the past, inclusive. A bill is `d31to60` when `dueDate` is 31 to 60 days in the past, inclusive. A bill is `d61plus` when `dueDate` is more than 60 days in the past. Day arithmetic SHALL be computed at start-of-day (UTC) granularity, not by raw millisecond difference, to avoid off-by-one errors on bills whose due date is today.

#### Scenario: A bill due in 15 days is classified as current

- **GIVEN** a bill with `dueDate` 15 days in the future and status APPROVED
- **WHEN** the aging report is computed
- **THEN** the bill's amount appears in the `current` bucket

#### Scenario: A bill 45 days overdue is classified as d31to60

- **GIVEN** a bill with `dueDate` 45 days in the past and status PENDING_APPROVAL
- **WHEN** the aging report is computed
- **THEN** the bill's amount appears in the `d31to60` bucket
- **AND** the 31–60 summary tile's count and amount include this bill

### Requirement: Only outstanding bills are included in the report

The system SHALL include in the report only bills with `status` equal to `PENDING_APPROVAL`, `APPROVED`, or `SCHEDULED`. Bills in status `DRAFT` SHALL be excluded because they are not yet committed. Bills in status `PAID` or `REJECTED` SHALL be excluded because they are terminal states.

#### Scenario: A PAID bill does not appear in any bucket

- **GIVEN** a bill with status PAID, regardless of `dueDate`
- **WHEN** the aging report is computed
- **THEN** the bill's amount does not appear in any bucket
- **AND** the bill's vendor row either does not appear or appears with zeros in all buckets when the vendor has other outstanding bills

#### Scenario: A DRAFT bill does not appear in any bucket

- **GIVEN** a bill with status DRAFT and a `dueDate` 20 days in the past
- **WHEN** the aging report is computed
- **THEN** the bill's amount does not appear in the `d1to30` bucket
- **AND** the bill's amount does not contribute to any total

### Requirement: The report groups by vendor and computes grand totals

The system SHALL group outstanding bills by `vendorId` and render one row per vendor. Each vendor row SHALL show the vendor name followed by bucket totals for Current, 1–30, 31–60, and 61+, and a row total. Beneath all vendor rows, a grand total row SHALL show column sums across all vendors and an overall grand total.

#### Scenario: A vendor with two bills in different buckets shows both totals

- **GIVEN** a vendor with one SCHEDULED bill for $1,000 due in 10 days (current bucket)
- **AND** another APPROVED bill for $2,500 due 40 days ago (d31to60 bucket)
- **WHEN** the report renders
- **THEN** that vendor's row shows $1,000.00 in the Current column, $2,500.00 in the 31–60 column, zero (or em-dash) in the other columns, and $3,500.00 in the row total

### Requirement: Overdue amounts are visually distinct

The system SHALL visually differentiate amounts in the overdue buckets on both the summary tiles and the table cells. The Current bucket SHALL render in neutral (default text color). The 1–30 bucket SHALL render in subtle amber. The 31–60 bucket SHALL render in a stronger amber-to-red. The 61+ bucket SHALL render in red with semibold weight. Zero values SHALL render as an em-dash character rather than "$0.00" in the table cells, to reduce visual noise. The grand total row SHALL always render numeric values including zero.

#### Scenario: A zero cell shows an em-dash

- **GIVEN** a vendor with bills only in the current bucket
- **WHEN** the vendor's row renders
- **THEN** the 1–30, 31–60, and 61+ cells for that row display an em-dash
- **AND** the current and total cells display dollar amounts

### Requirement: The report renders coherently with no outstanding bills

The system SHALL, when no bills match the outstanding filter, render the page without error. Summary tiles SHALL show zero values. The table body SHALL show a single "No outstanding bills" row instead of vendor rows. The grand total row SHALL either render with zero values or be omitted.

#### Scenario: A fully-paid scenario still renders the report shell

- **GIVEN** every bill in the database is either PAID, REJECTED, or DRAFT
- **WHEN** the user opens the report
- **THEN** the summary tiles render with zero values
- **AND** the table body shows "No outstanding bills"
- **AND** no error or empty-page is rendered

