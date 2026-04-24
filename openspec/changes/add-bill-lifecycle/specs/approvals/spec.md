# approvals — Delta Spec

## ADDED Requirements

### Requirement: The approval threshold is a single named constant

The system SHALL define `APPROVAL_THRESHOLD_CENTS` in exactly one file: `src/features/approvals/approval-rules.ts`. The MVP value SHALL be `500_000` (representing $5,000 USD). All code that checks the threshold SHALL import this constant — no inline magic numbers.

#### Scenario: The threshold is sourced from a single location

- **GIVEN** the codebase grep for the numeric literal `500_000` or `500000`
- **WHEN** results are inspected
- **THEN** only `src/features/approvals/approval-rules.ts` defines the value
- **AND** every other use site imports it

### Requirement: A helper function encapsulates the threshold check

The system SHALL expose `requiresApproval(amountCents: number): boolean` from `approval-rules.ts`, returning `true` when `amountCents >= APPROVAL_THRESHOLD_CENTS`.

#### Scenario: The threshold boundary is inclusive

- **GIVEN** three bill amounts: `499_999`, `500_000`, and `500_001` cents
- **WHEN** `requiresApproval` is called on each
- **THEN** it returns `false`, `true`, `true` respectively
