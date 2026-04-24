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

### Requirement: The inbox page lists all bills with default ordering

The system SHALL render at `/bills` a table of all bills the current user can see, ordered by `dueDate` ascending by default. The column set SHALL include: status, vendor name, invoice number, amount (formatted as USD currency), due date (formatted with a relative indicator), and last updated (relative time).

#### Scenario: Default view shows every seeded bill

- **GIVEN** the seed has run (14 bills across all statuses)
- **AND** no filter is active in the URL
- **WHEN** the user opens `/bills`
- **THEN** the table renders 14 rows
- **AND** the first row has the earliest `dueDate`
- **AND** the last row has the latest `dueDate`

### Requirement: All filter state is persisted in the URL

The system SHALL represent every inbox filter as a URL search parameter: `status`, `due`, `mine`, and `q`. The system SHALL NOT persist any filter state in component state or browser storage that is not also reflected in the URL. Navigating to a URL with filter params SHALL reproduce the exact filtered view.

#### Scenario: A shared URL reproduces a filtered view

- **GIVEN** a user composed the URL `/bills?status=PENDING_APPROVAL&q=latham`
- **WHEN** another user (same role) opens that URL directly
- **THEN** the filter sidebar shows "Pending approval" selected and "latham" in the search
- **AND** the table shows only bills matching both criteria

#### Scenario: Filter changes do not create browser history entries

- **GIVEN** the user is on `/bills` with no filters
- **WHEN** the user applies a status filter, then a search term, then clears both
- **THEN** pressing the browser Back button returns to the page the user was on before `/bills`
- **AND** does not step through intermediate filter states

### Requirement: The "Needs my approval" filter respects the current user's role

The system SHALL, when the `mine=1` URL parameter is present, request bills with `needsMyApproval: true` from the tRPC `bill.list` query. This query returns an empty array for users whose role is not `APPROVER`, which the UI SHALL render as the empty state — not as an error.

#### Scenario: SUBMITTER sees the empty state for "Needs my approval"

- **GIVEN** the current user is Gus (SUBMITTER)
- **AND** three PENDING_APPROVAL bills exist
- **WHEN** the user enables "Needs my approval"
- **THEN** the table renders the empty-state block
- **AND** no error toast or banner is shown

#### Scenario: APPROVER sees PENDING_APPROVAL bills for "Needs my approval"

- **GIVEN** the current user is Ada (APPROVER)
- **AND** three PENDING_APPROVAL bills exist
- **WHEN** the user enables "Needs my approval"
- **THEN** the table renders exactly those three bills

### Requirement: Search is debounced and case-insensitive

The system SHALL debounce search input by 200 ms before committing the value to the URL and re-querying. The server-side search SHALL match against both `vendor.name` and `bill.invoiceNumber` using case-insensitive partial matching.

#### Scenario: Typing filters the table after a pause

- **GIVEN** the user types "lat" into the search input over ~150 ms
- **WHEN** the user stops typing
- **THEN** approximately 200 ms after the last keystroke, the URL updates to `?q=lat`
- **AND** the table narrows to the Latham & Watkins bill
- **AND** fewer than two tRPC `bill.list` queries were issued during the typing

### Requirement: Overdue bills are visually distinct

The system SHALL, for bills with `dueDate` in the past AND `status !== PAID`, render the Due column with a visually distinct warning style (e.g., red text). The style SHALL be applied to the Due cell only, not to the entire row. Bills that are past due but already PAID SHALL render with neutral styling.

#### Scenario: An overdue pending bill shows red

- **GIVEN** a bill with `dueDate` two days ago and `status = PENDING_APPROVAL`
- **WHEN** it renders in the inbox table
- **THEN** the Due cell shows "Overdue 2d"
- **AND** the cell's color is red
- **AND** other cells in the row use default styling

#### Scenario: A paid bill past its due date does not show red

- **GIVEN** a bill with `dueDate` ten days ago and `status = PAID`
- **WHEN** it renders in the inbox table
- **THEN** the Due cell shows an absolute date like "Apr 14"
- **AND** the cell's color is muted, not red

### Requirement: Clicking a row navigates to the bill detail page

The system SHALL make the entire inbox row a navigable target to `/bills/[id]`. Clicking anywhere on the row (except interactive elements, if any) SHALL trigger navigation. The row SHALL also be keyboard-accessible: focusable with Tab, activated with Enter.

#### Scenario: Keyboard users can navigate rows

- **GIVEN** the inbox table has rendered
- **WHEN** the user presses Tab until a row receives focus
- **AND** presses Enter
- **THEN** the browser navigates to `/bills/<that-row-id>`

### Requirement: An empty filter result renders a recoverable empty state

The system SHALL, when an applied filter combination returns zero bills, render a centered empty-state block containing a short message and a "Clear filters" button. Clicking the button SHALL reset all URL filter parameters.

#### Scenario: A nonsense search clears via the button

- **GIVEN** the user has typed "asdfjkl" into search
- **AND** the table is showing the empty state
- **WHEN** the user clicks "Clear filters"
- **THEN** the URL returns to `/bills`
- **AND** the table renders all 14 seeded bills

### Requirement: The detail page is a dynamic route served by a Server Component

The system SHALL expose `/bills/[id]` as a dynamic route. The route SHALL fetch the bill server-side via a tRPC caller and pass it to the client-side detail view as initial data. If the bill does not exist, the route SHALL render a Next.js 404 via `notFound()`.

#### Scenario: A non-existent bill ID renders a 404

- **GIVEN** no bill exists with id `"does-not-exist"`
- **WHEN** a user opens `/bills/does-not-exist`
- **THEN** the page renders the application's 404 response
- **AND** does not throw an uncaught exception

### Requirement: The action bar is contextual on status and role

The system SHALL render action bar content based on the bill's current status and the current user's role. The exact mapping is:

- Status DRAFT, any role: a primary "Submit bill" button.
- Status PENDING_APPROVAL, role APPROVER: a primary "Approve" button and a secondary "Reject" button.
- Status PENDING_APPROVAL, role SUBMITTER: an informational row reading "Waiting on approver", with no action buttons.
- Status APPROVED, any role: a primary "Schedule payment" button.
- Status SCHEDULED, any role: a primary "Send payment" button, with a secondary line showing the scheduled date and method.
- Status PAID, any role: a success block showing the confirmation number.
- Status REJECTED, any role: a muted block showing the rejection reason.

#### Scenario: SUBMITTER sees "Waiting on approver" on a pending bill

- **GIVEN** a bill in status PENDING_APPROVAL
- **AND** the current user's role is SUBMITTER
- **WHEN** the user opens the bill's detail page
- **THEN** the action bar shows "Waiting on approver"
- **AND** no action button is visible

#### Scenario: APPROVER sees approve and reject on a pending bill

- **GIVEN** a bill in status PENDING_APPROVAL
- **AND** the current user's role is APPROVER
- **WHEN** the user opens the bill's detail page
- **THEN** the action bar shows an Approve button and a Reject button

### Requirement: Approve and reject require an approver

The system SHALL only invoke the `approve` and `reject` mutations from UI affordances visible to APPROVER users. If a SUBMITTER attempts these mutations by any means (e.g., dev tools), the server-side service SHALL reject them and the UI SHALL display the error in a toast.

#### Scenario: A forged approve call by a SUBMITTER fails and is toasted

- **GIVEN** the current user is Gus (SUBMITTER)
- **AND** a bill is in PENDING_APPROVAL
- **WHEN** the `bill.approve` mutation is invoked directly (bypassing the UI)
- **THEN** the mutation's `onError` fires
- **AND** a red toast displays the error message
- **AND** the bill's status remains PENDING_APPROVAL

### Requirement: The schedule payment dialog defaults thoughtfully

The system SHALL, when opening the schedule payment dialog:

- Default the pay date to today plus two days.
- Default the method to the vendor's `paymentMethod`.
- Disable the confirm button when the chosen date is in the past.

#### Scenario: ACH-preferring vendor defaults to ACH

- **GIVEN** a bill whose vendor has `paymentMethod = ACH`
- **AND** the bill is in status APPROVED
- **WHEN** the user opens the schedule payment dialog
- **THEN** the method radio is pre-selected to ACH
- **AND** the date picker shows today plus two days

### Requirement: The reject dialog requires a non-trivial reason

The system SHALL require the rejection reason to be at least 3 characters before the reject button is enabled. An empty or whitespace-only reason SHALL NOT be acceptable.

#### Scenario: An empty reason does not permit rejection

- **GIVEN** the reject dialog is open on a PENDING_APPROVAL bill
- **WHEN** the user has entered no reason (or only whitespace)
- **THEN** the "Reject bill" button is disabled
- **AND** the mutation is not invoked

### Requirement: The activity timeline reflects every bill event

The system SHALL render, on the detail page, every `BillEvent` for the bill in chronological order (oldest first). Each entry SHALL include: actor name, humanized verb, relative timestamp, and any event-specific secondary content (rejection reason for `rejected`, method plus date for `scheduled`, confirmation string for `paid`).

#### Scenario: A fully-paid bill shows five timeline entries

- **GIVEN** a bill that was created, submitted above threshold, approved, scheduled, and paid
- **WHEN** the user opens its detail page
- **THEN** the timeline shows exactly five entries
- **AND** the entries are ordered: created, submitted, approved, scheduled, paid
- **AND** the `paid` entry's secondary line contains the confirmation string

### Requirement: Mutations invalidate cached queries so the UI updates without reload

The system SHALL, on the success of any bill lifecycle mutation, invalidate the `bill.get` query for that bill's id and the `bill.list` query. The UI SHALL reflect the new state without a manual page reload.

#### Scenario: Approving updates the status pill without reload

- **GIVEN** a PENDING_APPROVAL bill is open in the detail view
- **AND** the current user is an APPROVER
- **WHEN** the user clicks Approve
- **THEN** the mutation succeeds
- **AND** the status pill updates to "Approved" without the page being reloaded
- **AND** a new entry appears in the activity timeline

### Requirement: Keyboard shortcuts only fire when the corresponding action is available

The system SHALL register `A` and `R` keyboard shortcuts only when the current user can approve or reject the displayed bill (status is PENDING_APPROVAL and role is APPROVER). The shortcuts SHALL NOT fire when focus is inside an `<input>`, `<textarea>`, or contenteditable element.

#### Scenario: A SUBMITTER pressing A on a pending bill does nothing

- **GIVEN** the current user is a SUBMITTER
- **AND** a PENDING_APPROVAL bill is open
- **WHEN** the user presses the `A` key
- **THEN** no mutation is invoked
- **AND** no dialog opens
- **AND** no toast appears

#### Scenario: Typing 'a' in the reject reason does not fire the approve shortcut

- **GIVEN** the current user is an APPROVER
- **AND** the reject dialog is open
- **WHEN** the user types "abuse" into the reason textarea
- **THEN** the approve mutation is not invoked

