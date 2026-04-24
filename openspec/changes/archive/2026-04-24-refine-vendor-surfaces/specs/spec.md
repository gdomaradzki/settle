# vendors — Delta Spec

## ADDED Requirements

### Requirement: The add-vendor dialog captures fields conditional on payment method

The system SHALL, in the add-vendor dialog, render name, email, and default GL category fields at all times. When the selected payment method is ACH, the dialog SHALL additionally render an account last-4 input and a routing last-4 input. When the selected payment method is CHECK, the dialog SHALL render a mailing address textarea. Toggling between methods SHALL preserve values already entered in either branch's fields.

#### Scenario: Switching methods preserves previously entered values

- **GIVEN** the dialog is open with method ACH
- **AND** the user has entered "9999" as the account last 4
- **WHEN** the user switches method to CHECK, then back to ACH
- **THEN** the account last-4 input again shows "9999"

### Requirement: ACH last-4 fields validate as exactly four digits

The system SHALL accept empty values for both `achAccountLast4` and `achRoutingLast4` (they are optional). When non-empty, each SHALL be exactly four digits (`^\d{4}$`). Values failing the pattern SHALL display an inline error and block submission.

#### Scenario: Non-numeric account last 4 is rejected

- **GIVEN** the dialog has payment method ACH
- **AND** the user enters "abcd" in account last 4
- **WHEN** the user attempts to submit
- **THEN** an inline error on that field reads that four digits are required
- **AND** the vendor is not created

### Requirement: Clicking a vendor row navigates to the filtered inbox

The system SHALL make each row on the `/vendors` page a navigable link to `/bills?vendor=<vendorId>`. Clicking anywhere on the row (except on an interactive control) SHALL trigger navigation. Rows SHALL also be keyboard-accessible (focusable with Tab, activated with Enter).

#### Scenario: Clicking a vendor row opens the filtered bills inbox

- **GIVEN** the user is on `/vendors`
- **WHEN** the user clicks the Amazon Web Services row
- **THEN** the browser navigates to `/bills?vendor=<awsId>`
- **AND** the inbox's vendor filter shows "Amazon Web Services" selected
- **AND** the bills table lists only bills belonging to Amazon Web Services
