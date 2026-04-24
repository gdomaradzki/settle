# users — Delta Spec

## ADDED Requirements

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
