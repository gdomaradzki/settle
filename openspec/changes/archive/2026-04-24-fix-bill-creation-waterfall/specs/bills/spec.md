# bills — Delta Spec

## ADDED Requirements

### Requirement: A combined create-and-submit mutation exists for intake

The system SHALL expose `bill.createAndSubmit`, a protected mutation that accepts the same input as `bill.create`, inserts a new bill as DRAFT, and immediately transitions it through `submit` (to APPROVED if under the approval threshold, otherwise to PENDING_APPROVAL), all within a single Prisma transaction. The mutation SHALL return the bill in its post-submit state.

#### Scenario: Combined mutation issues one server round-trip

- **GIVEN** the user has filled the intake form with a valid over-threshold bill
- **WHEN** the user clicks "Submit for approval"
- **THEN** the browser issues exactly one `bill.createAndSubmit` request (not a separate `bill.create` followed by `bill.submit`)
- **AND** the response contains the bill in status PENDING_APPROVAL

### Requirement: Combined create-and-submit is atomic

The system SHALL wrap the entire create-and-submit flow in a single database transaction. If either the insert or the subsequent submit transition fails for any reason, the transaction SHALL be rolled back and no bill SHALL persist.

#### Scenario: A failed submission leaves no orphan DRAFT

- **GIVEN** a forced failure on the submit step (e.g., a triggered constraint violation on `BillEvent` insert)
- **WHEN** `bill.createAndSubmit` runs
- **THEN** the mutation rejects with an error
- **AND** no new `Bill` row exists in the database
- **AND** no new `BillEvent` rows exist in the database

### Requirement: Transition inner functions are reusable across mutations

The system SHALL refactor `createBill` and `submitBill` in `bill-service.ts` so their bodies are callable with an externally-provided Prisma transaction client. This enables `createAndSubmitBill` to invoke both within one transaction without nesting `$transaction` calls or duplicating transition logic.

#### Scenario: Individual mutations continue to work unchanged

- **GIVEN** the refactor to extract inner transition helpers has been applied
- **WHEN** `bill.create` is called independently (e.g., from the "Save as draft" intake flow)
- **THEN** a bill is created in DRAFT with a `created` BillEvent, unchanged from prior behavior
- **AND** when `bill.submit` is called independently on that bill, the submit transition behaves unchanged
