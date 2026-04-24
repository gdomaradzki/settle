# vendors — Delta Spec

## ADDED Requirements

### Requirement: Vendors carry payment info referenced by bills

The system SHALL persist vendors with the following attributes: name, optional email, payment method (defaulting to ACH), optional ACH account last 4, optional ACH routing last 4, optional mailing address, optional default GL category, and `createdAt` timestamp.

#### Scenario: A vendor can be referenced by many bills

- **GIVEN** a vendor exists
- **WHEN** several bills are created referencing that vendor
- **THEN** each bill stores the vendor's ID in its `vendorId` column
- **AND** the vendor can be loaded from any of those bills via relation

### Requirement: Payment method is enumerated

The system SHALL constrain `Vendor.paymentMethod` to one of: `ACH`, `CHECK`. Any other value SHALL be rejected at the database layer.

#### Scenario: Invalid payment methods are rejected

- **GIVEN** a request to create a vendor with `paymentMethod = "WIRE"` (not in the enum)
- **WHEN** the insert is attempted
- **THEN** the database layer rejects it as an enum constraint violation

### Requirement: Seed vendors cover both payment methods

Seed data SHALL include at least one vendor with `paymentMethod = ACH` and at least one with `paymentMethod = CHECK`, so demo flows can exercise both scheduling paths.

#### Scenario: After seeding, both ACH and CHECK vendors exist

- **GIVEN** the seed script has run on an empty database
- **WHEN** vendors are grouped by `paymentMethod`
- **THEN** at least one vendor with `paymentMethod = ACH` is present
- **AND** at least one vendor with `paymentMethod = CHECK` is present
