# bills Specification

## Purpose
TBD - created by archiving change add-core-schema. Update Purpose after archive.
## Requirements
### Requirement: Bill records capture all data needed for the AP lifecycle

The system SHALL persist bills with the following attributes: vendor reference, optional invoice number, amount in cents, currency (defaulting to "USD"), issue date, due date, status (defaulting to DRAFT), optional memo, optional GL category, optional PDF path, lifecycle timestamps, creator reference, and created/updated timestamps.

#### Scenario: A new bill is persisted with DRAFT status

- **GIVEN** a valid vendor exists
- **WHEN** a bill is inserted with the required fields
- **THEN** it is persisted with `status = DRAFT`
- **AND** `createdAt` is set to the current time
- **AND** a `BillEvent` of `type = "created"` referencing the bill is also inserted

### Requirement: Money is stored as integer cents

The system SHALL store all monetary values (`Bill.amountCents`, `BillLineItem.amountCents`) as `Int`.
The system SHALL NOT use floating-point types for monetary values.

#### Scenario: A $50.00 bill is stored as 5000

- **GIVEN** a request to create a bill with a total of fifty US dollars
- **WHEN** the bill is persisted
- **THEN** `amountCents` equals `5000`

### Requirement: Bill status is an enumerated lifecycle

The system SHALL constrain `Bill.status` to one of: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PAID`, `REJECTED`. Any other value SHALL be rejected at the database layer.

#### Scenario: Invalid status values are rejected

- **GIVEN** a request to create a bill with `status = "CANCELLED"` (not in the enum)
- **WHEN** the insert is attempted
- **THEN** the database layer rejects it as an enum constraint violation

### Requirement: Every bill status transition is auditable

The system SHALL maintain a `BillEvent` table recording every status transition, containing: bill reference (cascade delete), type (`created | submitted | approved | rejected | scheduled | paid | edited`), actor reference, optional JSON payload, and a timestamp.

#### Scenario: Events persist with their bill

- **GIVEN** a bill has several BillEvent rows
- **WHEN** the bill is deleted
- **THEN** all related BillEvent rows are deleted via cascade

### Requirement: Bill line items are structured, not JSON

The system SHALL store line items in a dedicated `BillLineItem` table with cascade delete from `Bill`. Each line item SHALL carry: description, amount in cents, type, and optional GL category.

#### Scenario: Line items are queryable as independent rows

- **GIVEN** a bill with three line items that have varying `glCategory` values
- **WHEN** `BillLineItem` is queried filtered by `glCategory`
- **THEN** only line items matching the filter are returned as distinct rows
- **AND** each returned row exposes `billId`, `description`, `amountCents`, `type`, and `glCategory` as columns — not as nested JSON

### Requirement: Line items are classified as expense or item

The system SHALL constrain `BillLineItem.type` to one of: `EXPENSE`, `ITEM`.

- `EXPENSE` represents operational costs that post directly to the P&L (consulting, subscriptions, utilities).
- `ITEM` represents resellable goods or inventory.

The system SHALL default `BillLineItem.type` to `EXPENSE` at creation time.

#### Scenario: A new line item defaults to EXPENSE

- **GIVEN** a bill is being created
- **WHEN** a line item is inserted without specifying `type`
- **THEN** the stored `type` equals `EXPENSE`

### Requirement: Lifecycle timestamps are denormalized onto the bill

The system SHALL store `submittedAt`, `approvedAt`, `approvedById`, `rejectedAt`, `rejectedReason`, `scheduledPayDate`, `scheduledMethod`, `paidAt`, and `paymentConfirmation` directly on the `Bill` row. The narrative detail SHALL live in `BillEvent`; the denormalized columns exist to support fast, indexable queries for dashboard and inbox views.

#### Scenario: Approved-at timestamp is readable directly from the bill

- **GIVEN** a bill whose status has been advanced to `APPROVED`
- **WHEN** the bill is loaded by ID
- **THEN** `approvedAt` is populated on the bill row itself
- **AND** retrieving it requires no join to `BillEvent`

### Requirement: The bills table is indexed for inbox and dashboard queries

The system SHALL maintain a composite index on `(status, dueDate)` and a single-column index on `vendorId`.

#### Scenario: Filtering by status and due date uses the composite index

- **GIVEN** the `Bill` table populated with many rows
- **WHEN** a query filters by `status` and a `dueDate` window (the inbox and dashboard hot path)
- **THEN** the query planner uses the `(status, dueDate)` composite index rather than a sequential scan

