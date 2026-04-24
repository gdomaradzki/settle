# bills — Delta Spec

## ADDED Requirements

### Requirement: The bill intake form requires line items to sum to the bill amount

The system SHALL validate, before submitting a new bill, that the sum of `lineItems[*].amountCents` equals `amountCents`. If they differ, the form SHALL display an inline error on the line items field and prevent submission.

#### Scenario: Mismatched totals block submission

- **GIVEN** the user has filled the form with `amountCents = 100_000`
- **AND** two line items summing to `90_000`
- **WHEN** the user clicks "Save as draft" or "Submit for approval"
- **THEN** the form displays an error message on the line items field
- **AND** neither `bill.create` nor `bill.submit` is called

### Requirement: The bill intake form requires due date not before issue date

The system SHALL validate, before submitting a new bill, that `dueDate >= issueDate`. If violated, an inline error SHALL show on the due date field and submission SHALL be blocked.

#### Scenario: A due date earlier than issue date is rejected

- **GIVEN** `issueDate = 2026-05-01` and `dueDate = 2026-04-15`
- **WHEN** the user attempts to submit the form
- **THEN** an inline error reads "Due date cannot be before the issue date"
- **AND** submission is blocked

### Requirement: The intake form has two submit actions with distinct outcomes

The system SHALL offer two submission buttons on the bill intake form:

- **"Save as draft"**: creates the bill in DRAFT status via `bill.create` and navigates to the new bill's detail page.
- **"Submit for approval"**: creates the bill via `bill.create`, then immediately invokes `bill.submit` on the new id, routing the bill per the auto-approval threshold rules from the lifecycle spec.

Both actions SHALL disable each other while their respective mutation is in flight to prevent double-submission.

#### Scenario: Sub-threshold submission auto-approves

- **GIVEN** the user has filled a valid form with `amountCents = 300_000` (under $5,000)
- **WHEN** the user clicks "Submit for approval"
- **THEN** `bill.create` succeeds
- **AND** `bill.submit` is invoked on the new bill
- **AND** the resulting bill's status is APPROVED (auto-approval path)
- **AND** the user is navigated to the new bill's detail page

#### Scenario: Over-threshold submission requires an approver

- **GIVEN** the user has filled a valid form with `amountCents = 1_200_000` ($12,000)
- **WHEN** the user clicks "Submit for approval"
- **THEN** the resulting bill's status is PENDING_APPROVAL
- **AND** the user is navigated to the new bill's detail page

### Requirement: Line item amounts auto-sum into bill amount until the user edits the bill amount directly

The system SHALL, while the bill amount field has not been manually edited by the user since the form mounted, automatically set `amountCents` to the sum of line item amounts whenever a line item changes. Once the user edits the bill amount directly, the auto-update SHALL stop; subsequent line item changes SHALL not overwrite the user-entered amount.

#### Scenario: Auto-sum stops after manual edit

- **GIVEN** the user has two line items summing to `1_000_00`
- **AND** the bill amount reflects `1_000_00` via auto-sum
- **WHEN** the user edits the bill amount to `1_500_00`
- **AND** adds a third line item for `500_00`
- **THEN** the line items now sum to `1_500_00`
- **AND** the bill amount remains `1_500_00` (no overwrite)
- **AND** the sum validation passes on submit

### Requirement: A new vendor can be created inline from the vendor picker

The system SHALL, within the bill intake form's vendor combobox, expose a "+ Create new vendor" option that opens an inline dialog. On confirmation, the system SHALL invoke `vendor.create`, select the newly created vendor on the form, and close the dialog.

#### Scenario: Creating a vendor from intake selects it on the form

- **GIVEN** the user has opened the vendor combobox in the intake form
- **AND** the typed search does not match any existing vendor
- **WHEN** the user clicks "+ Create new vendor" and confirms with a valid name and payment method
- **THEN** `vendor.create` succeeds
- **AND** the new vendor appears as the selected value in the combobox
- **AND** the vendor list is invalidated so subsequent searches include the new entry
