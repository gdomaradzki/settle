# bills — Delta Spec

## ADDED Requirements

### Requirement: Bill status transitions happen exclusively through the bill service

The system SHALL route every `Bill.status` change through functions in `src/features/bills/bill-service.ts`. Routers, UI code, and scripts SHALL NOT write to `Bill.status` directly. This ensures transition validation, actor checks, and audit logging cannot be bypassed.

#### Scenario: Direct status writes are not permitted

- **GIVEN** a bill in status DRAFT
- **WHEN** code outside `bill-service.ts` attempts to update `Bill.status` directly
- **THEN** the codebase SHOULD fail code review; no runtime guard exists, but the convention is absolute and violations are regressions

### Requirement: Every status transition is atomic with its audit event

The system SHALL execute every bill status transition inside a single Prisma transaction that both updates the `Bill` row and appends a `BillEvent` row. If either operation fails, both SHALL be rolled back.

#### Scenario: A failed event insert rolls back the bill update

- **GIVEN** a bill in status PENDING_APPROVAL
- **AND** a forced failure on `BillEvent` insert (e.g., simulated via a DB constraint)
- **WHEN** `approveBill` is called
- **THEN** the bill's status remains PENDING_APPROVAL
- **AND** no partial `approvedAt` timestamp is persisted

### Requirement: Bills below the approval threshold self-approve on submit

The system SHALL, when `submitBill` is called on a DRAFT bill whose `amountCents < APPROVAL_THRESHOLD_CENTS`:

- Transition the bill to APPROVED directly, bypassing PENDING_APPROVAL
- Stamp `submittedAt`, `approvedAt`, and set `approvedById` to the submitter's ID
- Write both a `submitted` and an `approved` `BillEvent` in the same transaction

#### Scenario: A $2,000 bill auto-approves

- **GIVEN** a DRAFT bill with `amountCents = 200_000` and the submitter is Gus (SUBMITTER)
- **WHEN** `submitBill` is called by Gus
- **THEN** the bill's status is APPROVED
- **AND** `submittedAt` is populated
- **AND** `approvedAt` is populated
- **AND** `approvedById` equals Gus's user ID
- **AND** the bill has exactly two new events: one `submitted`, one `approved`

### Requirement: Bills at or above the approval threshold require an approver

The system SHALL, when `submitBill` is called on a DRAFT bill whose `amountCents >= APPROVAL_THRESHOLD_CENTS`:

- Transition the bill to PENDING_APPROVAL
- Stamp `submittedAt`
- Write a `submitted` `BillEvent`
- NOT populate `approvedAt` or `approvedById`

#### Scenario: A $12,500 bill goes to PENDING_APPROVAL

- **GIVEN** a DRAFT bill with `amountCents = 1_250_000`
- **WHEN** `submitBill` is called
- **THEN** the bill's status is PENDING_APPROVAL
- **AND** `submittedAt` is populated
- **AND** `approvedAt` is null
- **AND** exactly one `submitted` event was written

### Requirement: Only APPROVER users may approve or reject bills

The system SHALL reject any call to `approveBill` or `rejectBill` whose actor has `role !== 'APPROVER'`, raising an authorization error. No state change, no event, SHALL be persisted on such calls.

#### Scenario: A SUBMITTER attempts to approve

- **GIVEN** a bill in status PENDING_APPROVAL
- **AND** the current user's role is SUBMITTER
- **WHEN** `approveBill` is called
- **THEN** an `UnauthorizedError` is raised
- **AND** the bill's status remains PENDING_APPROVAL
- **AND** no new `BillEvent` is written

### Requirement: Transitions from invalid source statuses are rejected

The system SHALL validate the source status of every transition against a fixed table and raise `InvalidTransitionError` for any disallowed combination:

| Transition | Allowed source   |
| ---------- | ---------------- |
| `submit`   | DRAFT            |
| `approve`  | PENDING_APPROVAL |
| `reject`   | PENDING_APPROVAL |
| `schedule` | APPROVED         |
| `pay`      | SCHEDULED        |
| `update`   | DRAFT            |

#### Scenario: Approving an already-approved bill is rejected

- **GIVEN** a bill in status APPROVED
- **WHEN** `approveBill` is called by an APPROVER
- **THEN** an `InvalidTransitionError` is raised carrying `fromStatus = APPROVED` and `toStatus = APPROVED`
- **AND** no state change is persisted

#### Scenario: Paying a DRAFT bill is rejected

- **GIVEN** a bill in status DRAFT
- **WHEN** `payBill` is called
- **THEN** an `InvalidTransitionError` is raised
- **AND** the bill's status remains DRAFT

### Requirement: REJECTED is a terminal status

The system SHALL NOT define any transition function that takes a bill out of REJECTED. A rejected bill remains rejected; resubmission requires creating a new bill.

#### Scenario: No transition function accepts REJECTED as a source

- **GIVEN** the full set of transition functions in `bill-service.ts`
- **WHEN** the source-status table is inspected
- **THEN** REJECTED does not appear as an allowed source for any function

### Requirement: Paid bills receive a generated confirmation string

The system SHALL, when `payBill` transitions a bill to PAID, generate a `paymentConfirmation` string matching the pattern `SETTLE-<unix-millis>-<6-char-random>` and stamp it on the `Bill` row. The same value SHALL be included in the `paid` `BillEvent` payload.

#### Scenario: A paid bill has a confirmation string

- **GIVEN** a bill in status SCHEDULED
- **WHEN** `payBill` is called
- **THEN** the bill's status is PAID
- **AND** `paymentConfirmation` matches `/^SETTLE-\d+-[A-Z0-9]{6}$/`
- **AND** the corresponding `paid` event's payload contains the same confirmation string

### Requirement: The list query supports a "needs my approval" filter

The system SHALL expose a `listBills` query that accepts a `needsMyApproval: boolean` filter. When true, the query SHALL return bills with `status = PENDING_APPROVAL`. If the calling user's role is not APPROVER, the query SHALL return an empty array without raising an error.

#### Scenario: A SUBMITTER sees an empty "needs my approval" list

- **GIVEN** PENDING_APPROVAL bills exist in the database
- **AND** the calling user's role is SUBMITTER
- **WHEN** `listBills({ needsMyApproval: true })` is called
- **THEN** the returned array is empty
- **AND** no error is raised
