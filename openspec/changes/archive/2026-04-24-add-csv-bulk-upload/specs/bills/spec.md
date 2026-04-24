# bills — Delta Spec

## ADDED Requirements

### Requirement: The bill router exposes a batch create mutation

The system SHALL expose `bill.createMany`, a protected mutation accepting an array of `CreateBillInput` (1 to 100 items inclusive). The mutation SHALL invoke `createManyBills` on the service, which inserts every bill as DRAFT and appends a `created` `BillEvent` for each, all within a single transaction.

#### Scenario: A successful batch returns the created count

- **GIVEN** the client submits `bill.createMany` with 5 valid inputs
- **WHEN** the mutation succeeds
- **THEN** the response is `{ created: 5 }`
- **AND** 5 new `Bill` rows exist in the database with status DRAFT
- **AND** 5 new `BillEvent` rows exist with `type = "created"` and `payload.source = "csv"`

### Requirement: Batch create is all-or-nothing

The system SHALL wrap every batch create in a single Prisma transaction. If any single insert fails, the transaction SHALL be rolled back and no new `Bill` or `BillEvent` rows SHALL persist from that batch.

#### Scenario: A mid-batch failure leaves no partial state

- **GIVEN** a batch of 5 inputs is submitted
- **AND** the database count of `Bill` rows before the call is N
- **WHEN** the third insert fails due to a foreign-key violation
- **THEN** the count of `Bill` rows after the call is exactly N
- **AND** no `BillEvent` rows were created from this batch

### Requirement: CSV-sourced bills are distinguishable in the event log

The system SHALL, when creating bills via `createManyBills`, set the `created` `BillEvent`'s `payload` to an object containing `source: "csv"`. This metadata supports future UI affordances (e.g., the detail page's timeline rendering "created (from CSV)" instead of just "created") without requiring a separate event type.

#### Scenario: CSV-imported bill's event payload identifies the source

- **GIVEN** a bill has been created via `bill.createMany`
- **WHEN** the bill's events are queried
- **THEN** the `created` event's `payload` contains `{ source: "csv" }`
