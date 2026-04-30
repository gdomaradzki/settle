# payments — Delta Spec

## ADDED Requirements

### Requirement: A daily cron job processes due scheduled payments

The system SHALL register a cron job named `process-scheduled-payments` in `cronRegistry`. The job's `run(ctx)` SHALL find every bill with `status = SCHEDULED` and `scheduledPayDate <= ctx.now`, then transition each to `PAID` through the bill service's existing pay transition. The job SHALL NOT introduce any new transition path; it SHALL use the same code that the manual "Send payment" button uses.

#### Scenario: A bill scheduled for today is paid by the cron

- **GIVEN** a bill in status `SCHEDULED` with `scheduledPayDate` set to today (UTC)
- **WHEN** `process-scheduled-payments` runs with `ctx.now` set to today
- **THEN** the bill's status is `PAID`
- **AND** `paidAt` is populated
- **AND** `paymentConfirmation` matches `/^SETTLE-\d+-[A-Z0-9]{6}$/`
- **AND** a new `BillEvent` of type `paid` exists for the bill
- **AND** the JobResult contains `processed: 1, skipped: 0, errors: []`

#### Scenario: A bill scheduled for tomorrow is not paid today

- **GIVEN** a bill in status `SCHEDULED` with `scheduledPayDate` set to one day after `ctx.now`
- **WHEN** `process-scheduled-payments` runs
- **THEN** the bill's status remains `SCHEDULED`
- **AND** no new `BillEvent` for that bill is written
- **AND** the JobResult does not list that bill in `processed` or `errors`

#### Scenario: A backdated scheduled bill is also paid

- **GIVEN** a bill in status `SCHEDULED` with `scheduledPayDate` set to one week before `ctx.now` (e.g., the cron failed to run for several days)
- **WHEN** `process-scheduled-payments` runs
- **THEN** the bill is transitioned to `PAID`
- **AND** the `paid` event's `payload.confirmation` matches the required pattern

### Requirement: The cron job is idempotent via the status filter

The system SHALL filter on `status = SCHEDULED` so that already-paid bills are excluded from candidate selection. Running the job a second time without external state change SHALL produce a `JobResult` with `processed: 0`.

#### Scenario: A second run finds nothing to do

- **GIVEN** `process-scheduled-payments` has just successfully processed all eligible bills
- **WHEN** the job is run a second time with the same `ctx.now`
- **THEN** the returned `JobResult` is `{ jobName: "process-scheduled-payments", processed: 0, skipped: 0, errors: [] }`
- **AND** no new `BillEvent` rows are created during the second run

### Requirement: The System user is the actor for cron-driven payments

The system SHALL pass the System user's id (the constant `SYSTEM_USER_ID` from `src/features/users/system-user.ts`) as the `actorId` for every `payBill` invocation made by `process-scheduled-payments`. The resulting `BillEvent` row SHALL have `actorId` equal to the System user's id, so the audit log distinguishes cron-driven payments from human-driven ones.

#### Scenario: A cron-driven payment's BillEvent shows the System actor

- **GIVEN** the System user exists in the database with `name = "System"`
- **AND** a `SCHEDULED` bill is processed by the cron
- **WHEN** the resulting `paid` `BillEvent` is loaded with its actor relation
- **THEN** the actor's `name` is `"System"`
- **AND** the actor's `id` equals `SYSTEM_USER_ID`

### Requirement: Per-bill failures do not stop the loop

The system SHALL wrap each `payBill(billId, SYSTEM_USER_ID)` call in a try/catch within the job. A thrown error SHALL be appended to the `JobResult.errors` array as `{ id: billId, message: <error.message> }`; subsequent bills SHALL continue to be processed.

#### Scenario: One bill's transition fails, others still pay

- **GIVEN** three `SCHEDULED` bills due today: B1, B2, B3
- **AND** B2 is in an inconsistent state that causes `payBill` to throw `new Error("boom")`
- **WHEN** `process-scheduled-payments` runs
- **THEN** B1 and B3 are transitioned to `PAID`
- **AND** B2 remains in status `SCHEDULED`
- **AND** the JobResult contains `processed: 2, skipped: 0, errors: [{ id: <B2.id>, message: "boom" }]`

### Requirement: Manual payment continues to work for SCHEDULED bills

The system SHALL preserve the existing "Send payment" button on the bill detail page. Calling `payBill` directly (via the tRPC `bill.pay` mutation triggered by that button) SHALL succeed for any `SCHEDULED` bill regardless of `scheduledPayDate`, with the calling user as the actor on the resulting `BillEvent`.

#### Scenario: A user pays a future-dated scheduled bill manually

- **GIVEN** a bill in status `SCHEDULED` with `scheduledPayDate` set to one week in the future
- **AND** the current user is Gus (SUBMITTER)
- **WHEN** Gus clicks "Send payment" on the bill detail page
- **THEN** the bill transitions to `PAID`
- **AND** the resulting `paid` `BillEvent`'s `actorId` is Gus's id (not the System user's id)
