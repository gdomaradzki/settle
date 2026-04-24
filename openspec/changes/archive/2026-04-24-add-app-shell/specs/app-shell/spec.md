# app-shell — Delta Spec

## ADDED Requirements

### Requirement: The root layout provides a tRPC + React Query provider

The system SHALL mount a single `<Providers>` client component in `src/app/layout.tsx` that wraps all children in both `trpc.Provider` and `QueryClientProvider`. Both clients SHALL be memoized with `useState` so they are not recreated on re-render.

#### Scenario: A child page can issue tRPC queries

- **GIVEN** the layout has mounted
- **WHEN** a child page calls `trpc.user.current.useQuery()`
- **THEN** the query executes and returns data
- **AND** no "no provider" runtime error is raised

### Requirement: The top bar is visible on every route

The system SHALL render a top bar with the Settle wordmark, primary navigation (Dashboard, Bills, Vendors, Reports), and the user switcher on every page rendered under the root layout.

#### Scenario: Top bar renders on the bills placeholder route

- **GIVEN** the dev server is running
- **WHEN** the user navigates to `/bills`
- **THEN** the page renders the top bar at the top of the viewport
- **AND** the "Bills" nav link is visually marked as active

### Requirement: The user switcher changes the session and refreshes the view

The system SHALL, when a user is selected from the user-switcher dropdown:

1. Issue a `POST /api/session` request with the selected user's ID as JSON body.
2. Receive a response that sets the `settle-user-id` cookie as `HttpOnly`, `Path=/`, `SameSite=Lax`, `Max-Age=2592000`.
3. Invoke `router.refresh()` from `next/navigation` so Server Components re-render against the new session.

#### Scenario: Switching from Gus to Ada persists across reloads

- **GIVEN** the current user is Gus
- **WHEN** the user selects Ada from the switcher dropdown
- **THEN** the top bar updates to show Ada after the refresh
- **AND** reloading the page (F5) still shows Ada
- **AND** restarting the dev server and reopening the page still shows Ada

### Requirement: The session route validates the user before writing the cookie

The system SHALL, at `POST /api/session`:

- Parse the request body as `{ userId: string }` validated via zod.
- Verify the user exists in the database.
- Return HTTP 404 with no cookie set if the user does not exist.
- Return HTTP 200 with `{ ok: true }` and `Set-Cookie` header on success.

#### Scenario: Unknown user IDs are rejected

- **GIVEN** a POST to `/api/session` with `{ userId: "not-a-real-cuid" }`
- **WHEN** the route handler processes it
- **THEN** the response status is 404
- **AND** no `Set-Cookie` header is present

### Requirement: Nav links resolve to pages with no 404

The system SHALL ensure every link in the top-bar primary navigation resolves to a rendered page, even if that page is a placeholder. The routes covered by this requirement are `/`, `/bills`, `/vendors`, and `/reports/ap-aging`.

#### Scenario: All four nav routes resolve

- **GIVEN** the dev server is running
- **WHEN** each of `/`, `/bills`, `/vendors`, `/reports/ap-aging` is visited
- **THEN** each route returns HTTP 200
- **AND** each route renders the top bar and a visible placeholder heading
