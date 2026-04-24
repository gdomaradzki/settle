# vendors — Delta Spec

## ADDED Requirements

### Requirement: The vendors page lists all vendors

The system SHALL render at `/vendors` a table of every vendor in the database, ordered alphabetically by name. Each row SHALL include the vendor name, payment method, a summary of account information appropriate to the method, default GL category (if set), and a summary of outstanding bills.

#### Scenario: The vendors page renders seeded vendors

- **GIVEN** the seed has run with 5 vendors
- **WHEN** the user opens `/vendors`
- **THEN** the table renders 5 rows, ordered alphabetically by vendor name
- **AND** each row shows the vendor's method as a badge and an account summary in the Account column

### Requirement: The vendor list query includes outstanding aggregates

The system SHALL extend the `vendor.list` query to compute per-vendor aggregates over bills in status `PENDING_APPROVAL`, `APPROVED`, or `SCHEDULED`. Each returned vendor SHALL include an `outstandingCount` (number of outstanding bills) and `outstandingCents` (sum of amountCents across those bills). Bills in `DRAFT`, `PAID`, or `REJECTED` SHALL NOT contribute to these aggregates.

#### Scenario: A vendor with one PAID and one APPROVED bill shows one outstanding

- **GIVEN** a vendor has one PAID bill for $5,000 and one APPROVED bill for $1,200
- **WHEN** `vendor.list` is called
- **THEN** that vendor's row has `outstandingCount = 1`
- **AND** `outstandingCents = 120_000`

### Requirement: The account column formats by payment method

The system SHALL render the Account column differently based on the vendor's payment method. ACH vendors with `achAccountLast4` SHALL display "\*\*\*\*" followed by the last four digits. Check vendors with `mailingAddress` SHALL display the first 40 characters of the address followed by an ellipsis when truncated. Vendors with no account info for their method SHALL display an em-dash.

#### Scenario: ACH vendor shows masked last four

- **GIVEN** a vendor with `paymentMethod = ACH` and `achAccountLast4 = "4521"`
- **WHEN** the row renders
- **THEN** the Account cell displays "\*\*\*\*4521"

#### Scenario: Check vendor shows truncated address

- **GIVEN** a vendor with `paymentMethod = CHECK` and `mailingAddress` longer than 40 characters
- **WHEN** the row renders
- **THEN** the Account cell displays the first 40 characters followed by an ellipsis

### Requirement: The vendors page exposes an add-vendor affordance

The system SHALL render a primary button labeled "+ Add vendor" in the vendors page toolbar. Clicking the button SHALL open a dialog containing fields for name (required), payment method (radio: ACH or CHECK, defaulted to ACH), and email (optional). On successful submission, the system SHALL invoke the existing `vendor.create` mutation, invalidate the vendor list query, close the dialog, and the new vendor SHALL appear in the table at its alphabetical position.

#### Scenario: Adding a new vendor appears in the table

- **GIVEN** the vendors page is open
- **WHEN** the user clicks "+ Add vendor", enters name "Acme Supplies", selects method CHECK, and confirms
- **THEN** the dialog closes
- **AND** a toast confirms the vendor was created
- **AND** "Acme Supplies" appears in the table in its alphabetical position
- **AND** the new row's Outstanding column shows "0 · —"

### Requirement: The add-vendor dialog is shared with intake

The system SHALL define the add-vendor dialog as a single reusable component at `src/features/vendors/components/add-vendor-dialog.tsx`. Both the vendors page toolbar and the intake form's inline vendor creation SHALL use this component. Any future change to dialog fields or behavior SHALL only need to be made in one place.

#### Scenario: Intake-created vendor appears on the vendors page

- **GIVEN** the user is on the intake form at `/bills/new`
- **AND** the user creates a new vendor via the combobox's "+ Create new vendor" option
- **WHEN** the user later navigates to `/vendors`
- **THEN** the newly-created vendor appears in the table
