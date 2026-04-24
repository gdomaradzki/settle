# bills — Delta Spec

## ADDED Requirements

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
