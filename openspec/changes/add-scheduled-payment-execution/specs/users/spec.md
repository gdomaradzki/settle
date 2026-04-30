# users — Delta Spec

## MODIFIED Requirements

### Requirement: Seed data includes one user per role

Seed data SHALL create at least one `SUBMITTER` and at least one `APPROVER` so the demo can exercise the approval handoff. The seeded human users are named "Gus Silva" (SUBMITTER) and "Ada Chen" (APPROVER). In addition, seed data SHALL create a designated `System` user with role `SUBMITTER` whose id equals the constant `SYSTEM_USER_ID` exported from `src/features/users/system-user.ts`. The System user SHALL be the `actorId` for every `BillEvent` written by a cron job; it exists so the audit log distinguishes system-driven changes from human-driven ones.

#### Scenario: A fresh seed produces a demonstrable handoff and the System actor

- **GIVEN** the seed script has run on an empty database
- **WHEN** the users table is queried
- **THEN** at least one user with `role = SUBMITTER` exists named "Gus Silva"
- **AND** at least one user with `role = APPROVER` exists named "Ada Chen"
- **AND** exactly one user with `id = SYSTEM_USER_ID` and `name = "System"` exists

#### Scenario: The seed is idempotent across the System user

- **GIVEN** the seed has been run once and produced the System user
- **WHEN** the seed is run again
- **THEN** the seed completes without error
- **AND** the database still contains exactly one user with `id = SYSTEM_USER_ID`
