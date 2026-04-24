# bills — Delta Spec

## ADDED Requirements

### Requirement: The bill list query accepts a vendor filter

The system SHALL extend `listBills` to accept an optional `vendorId: string`. When present, the query SHALL return only bills with a matching `vendorId`. When absent, the filter SHALL have no effect on the result set.

#### Scenario: Filtering by vendor returns only that vendor's bills

- **GIVEN** three vendors each with two outstanding bills
- **WHEN** `listBills` is called with `vendorId` set to the second vendor's id
- **THEN** the returned list contains exactly two bills
- **AND** every returned bill has `vendorId` equal to the filter value

### Requirement: The inbox sidebar exposes a vendor filter

The system SHALL render, in the inbox filter sidebar, a vendor filter below the existing status and due-window filters. The filter SHALL be a select control populated by `vendor.list` ordered alphabetically by name, with an "Any vendor" option at the top. Selecting a vendor SHALL update the URL with `?vendor=<id>` and narrow the table. Selecting "Any vendor" SHALL clear the URL param.

#### Scenario: Selecting a vendor narrows the table and updates the URL

- **GIVEN** the user is on `/bills` with no filters
- **WHEN** the user opens the vendor select and chooses Amazon Web Services
- **THEN** the URL updates to include `vendor=<awsId>`
- **AND** the table re-renders showing only AWS bills

### Requirement: The vendor filter is round-trippable via URL

The system SHALL, when a user opens `/bills?vendor=<id>` directly, apply the filter on load. The sidebar's vendor select SHALL show the matching vendor as its selected value.

#### Scenario: Direct URL entry applies the filter

- **GIVEN** the user opens `/bills?vendor=<awsId>` in a new tab
- **WHEN** the inbox has finished rendering
- **THEN** the vendor filter shows "Amazon Web Services" selected
- **AND** the table shows only AWS bills
