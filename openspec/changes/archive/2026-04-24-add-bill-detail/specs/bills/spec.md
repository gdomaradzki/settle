# bills — Delta Spec

## ADDED Requirements

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
