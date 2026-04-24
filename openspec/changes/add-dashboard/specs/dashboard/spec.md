# dashboard — Delta Spec

## ADDED Requirements

### Requirement: The dashboard is the default landing page

The system SHALL render the dashboard at the root route `/`. This replaces the placeholder "Dashboard coming soon" added in the app shell change.

#### Scenario: The root URL serves the dashboard

- **GIVEN** the application is deployed
- **WHEN** a user opens the root URL `/`
- **THEN** the dashboard renders with a greeting, three tiles, and recent activity
- **AND** the "Dashboard coming soon" placeholder is no longer present

### Requirement: The "Needs my approval" tile is role-gated

The system SHALL show the "Needs my approval" tile on every dashboard render. For users with role APPROVER, the tile's value SHALL be the count of bills currently in status PENDING_APPROVAL. For users with any other role, the tile's value SHALL be `0`.

#### Scenario: SUBMITTER always sees zero

- **GIVEN** three PENDING_APPROVAL bills exist
- **AND** the current user's role is SUBMITTER
- **WHEN** the user opens the dashboard
- **THEN** the "Needs my approval" tile shows `0`
- **AND** no error or empty state is rendered

#### Scenario: APPROVER sees the live count

- **GIVEN** three PENDING_APPROVAL bills exist
- **AND** the current user's role is APPROVER
- **WHEN** the user opens the dashboard
- **THEN** the "Needs my approval" tile shows `3`

### Requirement: The "Due this week" tile counts bills due in the next 7 days

The system SHALL compute the "Due this week" tile value as the count of bills with:

- `status` in the set `{ PENDING_APPROVAL, APPROVED, SCHEDULED }`
- `dueDate` between the current moment and 7 days from now, inclusive on both ends
- `dueDate` NOT in the past (past-due bills have their own visual treatment in the inbox and are deliberately excluded here)

#### Scenario: Past-due bills do not inflate the tile

- **GIVEN** two bills with `dueDate` three days ago and status APPROVED (past-due)
- **AND** two bills with `dueDate` three days from now and status APPROVED
- **WHEN** the user opens the dashboard
- **THEN** the "Due this week" tile shows `2` (only the future-due ones)

### Requirement: The "Cash out next 30 days" tile sums committed outflows

The system SHALL compute the "Cash out next 30 days" tile value as the sum of `amountCents` across all bills where:

- `status` is APPROVED or SCHEDULED (committed outflows; DRAFT/PENDING could still disappear, PAID is already gone)
- `dueDate` is between now and 30 days from now
- The resulting cents value is formatted as USD via `formatUSD` before display

#### Scenario: Only committed bills are summed

- **GIVEN** one SCHEDULED bill for $2,000 due in 10 days
- **AND** one APPROVED bill for $3,000 due in 20 days
- **AND** one PENDING_APPROVAL bill for $10,000 due in 15 days
- **AND** one PAID bill for $5,000 (already paid)
- **WHEN** the user opens the dashboard
- **THEN** the "Cash out next 30 days" tile shows `$5,000.00`

### Requirement: Tiles deep-link into filtered inbox views

The system SHALL make the "Needs my approval" and "Due this week" tiles clickable, linking to `/bills?mine=1` and `/bills?due=this-week` respectively. The "Cash out next 30 days" tile SHALL NOT be a link, as there is no inbox filter that matches its composition.

#### Scenario: Clicking "Needs my approval" opens the filtered inbox

- **GIVEN** the user is on the dashboard
- **WHEN** the user clicks the "Needs my approval" tile
- **THEN** the browser navigates to `/bills?mine=1`
- **AND** the inbox's "Needs my approval" toggle is active

### Requirement: Recent activity shows the 8 most recent bill events

The system SHALL render, below the tiles, a "Recent activity" feed listing the 8 most recent `BillEvent` rows across all bills, ordered newest first. Each entry SHALL show: actor name, humanized verb, vendor name, relative timestamp. Clicking an entry SHALL navigate to that bill's detail page.

#### Scenario: Activity feed links to the underlying bill

- **GIVEN** a recent event of type `approved` for a bill belonging to vendor "Latham & Watkins"
- **WHEN** the user opens the dashboard
- **THEN** an entry reads something like "Ada Chen approved Latham & Watkins bill, 2 hours ago"
- **AND** clicking the entry navigates to that bill's detail page

#### Scenario: Empty activity renders a muted message, not an error

- **GIVEN** the database has zero `BillEvent` rows (hypothetical; not possible after seeding)
- **WHEN** the user opens the dashboard
- **THEN** the activity section renders a muted "No recent activity" message
- **AND** no error is shown
