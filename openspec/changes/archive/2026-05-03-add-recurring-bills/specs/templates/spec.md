# templates — Delta Spec

## ADDED Requirements

### Requirement: Bill templates persist a monthly recurrence definition

The system SHALL persist `BillTemplate` rows with: vendor reference, amount in cents, day-of-month (1 through 28), optional memo, optional GL category, optional `cancelledAt` timestamp, creator reference, and created/updated timestamps. Each template SHALL also support a related set of `BillTemplateLineItem` rows (`description`, `amountCents`, `type`, optional `glCategory`) deleted via cascade when the template is deleted.

#### Scenario: A new template is persisted with sensible defaults

- **GIVEN** a valid vendor exists
- **WHEN** a `BillTemplate` is inserted with `vendorId`, `amountCents = 450_000`, `dayOfMonth = 1`, and `createdById`
- **THEN** the row is persisted with the provided fields
- **AND** `cancelledAt` is null
- **AND** `createdAt` is set to the current time
- **AND** `updatedAt` is set to the current time

#### Scenario: Cascade delete removes line items

- **GIVEN** a template with three `BillTemplateLineItem` rows
- **WHEN** the template is deleted
- **THEN** all three line item rows are also deleted

### Requirement: Day-of-month is constrained to 1 through 28

The system SHALL constrain `BillTemplate.dayOfMonth` to the integer range `[1, 28]` inclusive at the input layer (zod schema). Values outside this range SHALL be rejected before any database write. The constraint is documented as a deliberate limit so every template fires every month — values 29 through 31 would silently skip months.

#### Scenario: A template with dayOfMonth = 31 is rejected

- **GIVEN** a request to create a template with `dayOfMonth = 31`
- **WHEN** the input passes through the create schema
- **THEN** the schema rejects the input with a validation error
- **AND** no `BillTemplate` row is inserted

#### Scenario: A template with dayOfMonth = 28 is accepted

- **GIVEN** a request to create a template with `dayOfMonth = 28`
- **WHEN** the input passes through the create schema
- **THEN** the schema accepts the input
- **AND** the row is persisted with `dayOfMonth = 28`

### Requirement: Generated bills auto-approve, skipping the approval threshold

The system SHALL, when generating a bill from a template, transition the bill directly to `SCHEDULED` regardless of `amountCents`. The generated bill SHALL carry `submittedAt`, `approvedAt`, `approvedById`, `scheduledPayDate`, and `scheduledMethod` populated at creation time. The approval threshold (`APPROVAL_THRESHOLD_CENTS`) is bypassed because the template was approved by a human at setup; per-instance re-approval is theatre.

#### Scenario: A $20,000 recurring bill skips PENDING_APPROVAL

- **GIVEN** an active template with `amountCents = 2_000_000` (= $20,000)
- **WHEN** the template generates a new instance
- **THEN** the resulting bill has `status = SCHEDULED`
- **AND** `submittedAt`, `approvedAt`, and `approvedById` are populated
- **AND** the bill never passed through `PENDING_APPROVAL`

### Requirement: Generated bills carry their template reference

The system SHALL set `Bill.recurringTemplateId` to the template's id on every cron-generated bill. Manually-created bills (via the existing intake flows) SHALL continue to have `recurringTemplateId = null`.

#### Scenario: A generated bill points at its template

- **GIVEN** a template with id `tpl-1` generates a new instance
- **WHEN** the resulting bill is loaded
- **THEN** `bill.recurringTemplateId` equals `"tpl-1"`

#### Scenario: A manually-created bill has a null template reference

- **GIVEN** the existing intake form is used to create a bill
- **WHEN** the resulting bill is loaded
- **THEN** `bill.recurringTemplateId` is null

### Requirement: A daily cron job generates due bills from active templates

The system SHALL register a cron job named `generate-recurring-bills` in `cronRegistry`. The job's `run(ctx)` SHALL:

- Compute `dayOfMonth = ctx.now.getUTCDate()`. If `dayOfMonth > 28`, return a JobResult with all-zero counts and an empty errors array immediately.
- Query active templates: `cancelledAt = null AND dayOfMonth = <today's day>`.
- For each template, call `createScheduledBillFromTemplate(template, today, template.createdById)` where `today` is `ctx.now` normalized to UTC midnight.
- Increment `processed` for each successful generation.
- Catch Prisma error code `P2002` (unique violation on `(recurringTemplateId, dueDate)`) and increment `skipped` (NOT `errors`) for that template.
- Append `{ id: template.id, message }` to `errors` for any other thrown error.

#### Scenario: An active template due today generates a new bill

- **GIVEN** an active template with `dayOfMonth = ctx.now.getUTCDate()` and no existing bill for `(templateId, today)`
- **WHEN** `generate-recurring-bills` runs
- **THEN** a new `Bill` is created with `status = SCHEDULED`, `recurringTemplateId = template.id`, and `dueDate` equal to `ctx.now` normalized to UTC midnight
- **AND** the JobResult contains `processed: 1, skipped: 0, errors: []`

#### Scenario: Cancelled templates are excluded

- **GIVEN** a template with `cancelledAt` set to yesterday and `dayOfMonth` matching today
- **WHEN** `generate-recurring-bills` runs
- **THEN** no bill is generated for that template
- **AND** the template does not appear in `processed`, `skipped`, or `errors`

#### Scenario: Templates whose dayOfMonth doesn't match today are excluded

- **GIVEN** an active template with `dayOfMonth = 5`
- **AND** today's UTC day-of-month is 15
- **WHEN** `generate-recurring-bills` runs
- **THEN** no bill is generated for that template

#### Scenario: A second run on the same day produces only skips

- **GIVEN** the cron has just successfully generated bills for all due-today templates
- **WHEN** the cron is invoked a second time on the same UTC day
- **THEN** the JobResult has `processed: 0`
- **AND** `skipped` equals the number of templates the previous run processed
- **AND** `errors` is empty

#### Scenario: On the 29th-31st, the job is a fast no-op

- **GIVEN** today's UTC day-of-month is 30
- **WHEN** `generate-recurring-bills` runs
- **THEN** no database query for templates is made (or if made, it returns an empty set)
- **AND** the JobResult is `{ jobName: "generate-recurring-bills", processed: 0, skipped: 0, errors: [] }`

### Requirement: Idempotency is enforced by a unique index

The system SHALL maintain a composite unique index on `Bill(recurringTemplateId, dueDate)`. Postgres SHALL treat NULL values as distinct, so manually-created bills with `recurringTemplateId = null` do not collide with each other. A second attempt to generate a bill for the same `(templateId, dueDate)` pair SHALL fail with Prisma error code `P2002`, which the cron treats as a `skipped` outcome.

#### Scenario: Duplicate generation is rejected at the database

- **GIVEN** a bill already exists with `recurringTemplateId = "tpl-1"` and `dueDate = 2026-05-01`
- **WHEN** an INSERT is attempted with the same `(templateId, dueDate)` pair
- **THEN** the database raises a unique constraint violation
- **AND** no second bill row is created

### Requirement: Cancelling a template stops future generation but does not touch in-flight bills

The system SHALL expose `cancelTemplate(templateId, actorId)` which sets `BillTemplate.cancelledAt` to the current time. Cancellation SHALL NOT modify, delete, or affect bills already generated from the template — those bills remain in their current status and proceed through the existing payment cron normally.

#### Scenario: A cancelled template's existing bills are unchanged

- **GIVEN** a template that has generated three bills currently in `SCHEDULED` status
- **WHEN** the template is cancelled
- **THEN** all three bills remain in `SCHEDULED`
- **AND** their `recurringTemplateId` still points at the now-cancelled template
- **AND** the next run of `process-scheduled-payments` (if its date filter matches) processes them normally

### Requirement: The templates page lists active templates with a creation affordance

The system SHALL render at `/templates` a list of every template where `cancelledAt IS NULL`, ordered by `createdAt` descending. Each row SHALL show vendor name, formatted amount (USD), day-of-month, and a link to the detail page. The page SHALL include a primary "+ New recurring bill" link to `/templates/new`.

#### Scenario: An empty active list shows the empty state and the create link

- **GIVEN** no active templates exist
- **WHEN** the user opens `/templates`
- **THEN** the page shows the empty-state block "No recurring bills set up yet."
- **AND** the "+ New recurring bill" link is still visible

#### Scenario: Cancelled templates are hidden from the list by default

- **GIVEN** two templates exist: one active, one cancelled
- **WHEN** the user opens `/templates`
- **THEN** only the active template is shown

### Requirement: The template detail page exposes generate-now and cancel actions

The system SHALL render at `/templates/[id]` the template's fields, the list of past generated bills (ordered by `dueDate` descending, with status pill and link to each bill's detail page), and two action buttons:

- "Generate next instance now" — calls `templates.runGenerationForOne`, which invokes the same `createScheduledBillFromTemplate` the cron uses with `dueDate = today (UTC midnight)`. On `P2002`, surfaces a CONFLICT toast "An instance for this template and due date already exists." Hidden or disabled when the template is cancelled.
- "Cancel template" — calls `templates.cancel`. Hidden when the template is already cancelled. When cancelled, the page renders a muted block reading "Cancelled on <date>".

#### Scenario: Generate-now produces a new bill and refreshes the list

- **GIVEN** an active template with no existing bill for today
- **WHEN** the user clicks "Generate next instance now"
- **THEN** a new bill is created with `status = SCHEDULED` and `recurringTemplateId` matching the template
- **AND** the page refreshes showing the new bill at the top of the past-instances list

#### Scenario: A second generate-now on the same day is rejected with a toast

- **GIVEN** the template has already been generated once today
- **WHEN** the user clicks "Generate next instance now" again
- **THEN** the mutation rejects with a `CONFLICT` TRPCError
- **AND** the UI displays a toast reading "An instance for this template and due date already exists."
- **AND** no second bill is created

### Requirement: The seed includes at least one active recurring template

The seed SHALL create at least one active `BillTemplate` so the `/templates` page is non-empty on a fresh database. The seed SHALL be idempotent: running `npm run db:seed` twice SHALL NOT duplicate the template or its line items.

#### Scenario: A fresh seed produces a non-empty templates list

- **GIVEN** the seed has just run on an empty database
- **WHEN** `/templates` is opened
- **THEN** at least one active template is rendered
