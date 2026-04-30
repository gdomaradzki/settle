# bills — Delta Spec

## ADDED Requirements

### Requirement: Bills carry an optional reference to a recurring template

The system SHALL add a nullable `recurringTemplateId` column to the `Bill` table with a foreign key to `BillTemplate`. Bills created manually (via the existing intake flows or the API) SHALL have `recurringTemplateId = null`. Bills created by the `generate-recurring-bills` cron job SHALL have `recurringTemplateId` set to the template's id.

#### Scenario: A manually-created bill has a null template reference

- **GIVEN** the existing intake form is used to create a bill
- **WHEN** the resulting bill row is loaded
- **THEN** `bill.recurringTemplateId` is null

#### Scenario: A cron-generated bill has its template id populated

- **GIVEN** a recurring template with id `tpl-1` has just been processed by the cron
- **WHEN** the resulting bill row is loaded
- **THEN** `bill.recurringTemplateId` equals `"tpl-1"`

### Requirement: A composite unique index enforces recurrence idempotency

The system SHALL maintain a composite unique index on `Bill(recurringTemplateId, dueDate)`. Postgres SHALL treat NULL `recurringTemplateId` values as distinct, so multiple manually-created bills with `null` template references can share a `dueDate` without collision. Two cron-generated bills for the same `(templateId, dueDate)` pair SHALL collide; the database raises Prisma error code `P2002`, which the cron treats as the idempotent-skip path.

#### Scenario: Two manual bills with the same dueDate do not collide

- **GIVEN** the database contains a bill with `recurringTemplateId = null` and `dueDate = 2026-05-15`
- **WHEN** another bill is inserted with `recurringTemplateId = null` and `dueDate = 2026-05-15`
- **THEN** the second insert succeeds
- **AND** both bills coexist with distinct ids

#### Scenario: Two cron-generated bills with the same template+dueDate collide

- **GIVEN** the database contains a bill with `recurringTemplateId = "tpl-1"` and `dueDate = 2026-05-15`
- **WHEN** an insert is attempted with `recurringTemplateId = "tpl-1"` and `dueDate = 2026-05-15`
- **THEN** the insert fails with Prisma error code `P2002`
- **AND** no second bill row is created

### Requirement: A bill creation path exists for cron-generated scheduled bills

The system SHALL add `createScheduledBillFromTemplate(template, dueDate, actorId)` to `bill-service.ts` as the only sanctioned way to insert a bill in non-`DRAFT` status. The function SHALL run inside a single Prisma transaction that creates the `Bill`, copies the template's line items into `BillLineItem`, and writes both a `created` `BillEvent` (with payload `{ source: "recurring", templateId, autoApproved: "true" }`) and a `scheduled` `BillEvent` (with payload `{ payDate, method }`). The bill's `submittedAt`, `approvedAt`, `approvedById`, `scheduledPayDate`, and `scheduledMethod` SHALL all be populated at creation time.

#### Scenario: A successful generation writes one row, all line items, and exactly two events

- **GIVEN** an active template with two line items
- **WHEN** `createScheduledBillFromTemplate(template, today, actorId)` succeeds
- **THEN** exactly one new `Bill` row exists for that template+date
- **AND** exactly two `BillLineItem` rows exist for the new bill
- **AND** exactly two `BillEvent` rows exist for the new bill: one of type `created`, one of type `scheduled`
- **AND** the `created` event's payload contains `{ source: "recurring", templateId: <template.id>, autoApproved: "true" }`

#### Scenario: A failed event insert rolls back the bill and line items

- **GIVEN** a forced failure on the `BillEvent.createMany` call inside `createScheduledBillFromTemplateInner`
- **WHEN** `createScheduledBillFromTemplate` is invoked
- **THEN** the function rejects with an error
- **AND** no new `Bill`, `BillLineItem`, or `BillEvent` rows persist for that invocation
