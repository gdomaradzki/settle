# users Specification

## Purpose
TBD - created by archiving change add-core-schema. Update Purpose after archive.
## Requirements
### Requirement: Users have a role that determines AP permissions

The system SHALL persist users with: name, unique email, and role. No password or authentication is stored — the MVP uses a fake session switcher.

#### Scenario: A user record carries exactly one role and no credentials

- **GIVEN** a user is created with `name`, `email`, and `role = SUBMITTER`
- **WHEN** the user is loaded by ID
- **THEN** the stored record has `role = SUBMITTER`
- **AND** no password, hash, or other credential field is present on the row

### Requirement: Two roles exist for the MVP

The system SHALL constrain `User.role` to one of: `SUBMITTER`, `APPROVER`.

- A `SUBMITTER` creates and submits bills, and schedules payments for approved bills.
- An `APPROVER` approves or rejects bills that are `PENDING_APPROVAL`.

#### Scenario: Invalid role values are rejected

- **GIVEN** a request to create a user with `role = "ADMIN"` (not in the enum)
- **WHEN** the insert is attempted
- **THEN** the database layer rejects it as an enum constraint violation

### Requirement: Seed data includes one user per role

Seed data SHALL create at least one `SUBMITTER` and at least one `APPROVER` so the demo can exercise the approval handoff. The seeded users are named "Gus Silva" (SUBMITTER) and "Ada Chen" (APPROVER).

#### Scenario: A fresh seed produces a demonstrable handoff

- **GIVEN** the seed script has run on an empty database
- **WHEN** the users table is queried
- **THEN** it contains exactly one user with `role = SUBMITTER`
- **AND** exactly one user with `role = APPROVER`

### Requirement: The users tRPC router exposes a list query

The system SHALL expose a `users.list` tRPC query that returns all users ordered by name ascending. Each result SHALL include `id`, `name`, `email`, and `role`. No credential fields SHALL be included (none exist in the schema, but this is stated to prevent future regressions).

#### Scenario: The list returns seeded users

- **GIVEN** the seed script has run
- **WHEN** `users.list` is queried
- **THEN** the result contains both Gus Silva (SUBMITTER) and Ada Chen (APPROVER)
- **AND** the users are ordered alphabetically by name (Ada before Gus)

### Requirement: The users tRPC router exposes a current-user query

The system SHALL expose a `users.current` tRPC query that returns the user resolved from the tRPC context. This user SHALL reflect the `settle-user-id` cookie on the request, falling back to the default seeded user when no cookie is set.

#### Scenario: Current user reflects the cookie

- **GIVEN** a request arrives with cookie `settle-user-id = <ada.id>`
- **WHEN** `users.current` is queried
- **THEN** the returned user is Ada Chen with `role = APPROVER`

#### Scenario: Current user falls back when no cookie is set

- **GIVEN** a request arrives with no `settle-user-id` cookie
- **WHEN** `users.current` is queried
- **THEN** the returned user is the seeded SUBMITTER (Gus Silva)
- **AND** no error is raised

