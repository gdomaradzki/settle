# app-shell — Delta Spec

## ADDED Requirements

### Requirement: Every router procedure has automated test coverage

The system SHALL include automated tests for every tRPC procedure across every router. Each `.query` and `.mutation` SHALL have at least one test verifying its happy-path behavior. Procedures with authorization rules, input validation, or error mapping SHALL additionally have tests for the rejection paths. Tests SHALL exercise procedures via `appRouter.createCaller({ user, db })` rather than calling the underlying service directly, so the auth and error-mapping wrapper is covered.

#### Scenario: Every router procedure is invoked by at least one test

- **GIVEN** the test suite has been written
- **WHEN** the test suite runs with coverage reporting enabled
- **THEN** every `.query` and `.mutation` defined under any `*-router.ts` is invoked by at least one test
- **AND** the line-coverage report shows over 85% coverage for `src/features/*/`

### Requirement: The bill state machine has comprehensive transition coverage

The system SHALL include tests covering every transition in the bill state machine, both threshold branches on submit, every invalid-source-status case, and authorization rejections. Each transition test SHALL assert: the resulting status, the appended `BillEvent` (count, type, payload), and any lifecycle timestamp populated by the transition. The state machine test SHALL additionally include at least one atomicity test that forces a mid-transaction failure and asserts no partial state persists.

#### Scenario: All five transitions and the threshold branch have tests

- **GIVEN** `src/features/bills/__tests__/bill-service.test.ts` exists
- **WHEN** the file is inspected
- **THEN** it contains tests for: submit-under-threshold (DRAFT to APPROVED), submit-over-threshold (DRAFT to PENDING_APPROVAL), approve, reject, schedule, and pay
- **AND** at least four tests covering invalid transitions
- **AND** at least one test covering authorization rejection
- **AND** at least one test covering atomicity

### Requirement: Critical UI components have isolated test coverage

The system SHALL include React Testing Library tests for the meaningful UI components: the bill intake form, the duplicate-bill modal, the vendor combobox, the add-vendor dialog, the bills table, the bills filter sidebar, the AP aging report, the dashboard view, the CSV preview table, and the bill status pill. Each test file SHALL render the component in isolation under jsdom and verify rendering and interaction behavior with mocked or synthetic props.

#### Scenario: The bill intake form's validation behavior is tested

- **GIVEN** `bill-intake-form.test.tsx` exists
- **WHEN** the test for "line items must sum to bill amount" runs
- **THEN** the form renders with line items summing to a different value than the bill amount
- **AND** submitting the form surfaces an inline validation error
- **AND** the mutation is not invoked

### Requirement: Critical user flows have end-to-end test coverage

The system SHALL include Playwright tests covering the core user journeys end-to-end against a running dev server with a seeded test database. Coverage SHALL include: the full bill lifecycle from PDF intake through payment, manual intake, CSV bulk upload, dashboard interactions, the AP aging report, vendor creation from both entry points, and inbox filters and sorting. At minimum two test files SHALL include mobile viewport variants exercising responsive behavior.

#### Scenario: The full lifecycle flow runs end-to-end

- **GIVEN** a fresh seeded test database and a running dev server
- **WHEN** the `bill-lifecycle-full.spec.ts` Playwright test runs
- **THEN** the test authenticates as Gus, creates an over-threshold bill, switches to Ada, approves the bill, switches back to Gus, schedules a payment, sends the payment
- **AND** the resulting bill has status PAID
- **AND** the timeline shows five events (created, submitted, approved, scheduled, paid)

### Requirement: Tests run against a separate test database

The system SHALL configure all test execution against a Postgres database distinct from development. Locally this SHALL be a Docker Postgres container on a non-default port (5433). In CI this SHALL be a GitHub Actions Postgres service container. No test SHALL pollute, modify, or rely on the seeded development database.

#### Scenario: Running tests does not affect dev data

- **GIVEN** the developer has seeded the development database
- **WHEN** the full test suite runs to completion locally
- **THEN** opening Prisma Studio against the development database shows only the original seeded rows
- **AND** no test rows persist in the development database

### Requirement: External services are mocked in tests

The system SHALL mock the Anthropic SDK and the Vercel Blob SDK in all unit tests. No unit test SHALL make real network calls to those services. Tests SHALL verify both success and failure paths of the wrapping code: extraction success, extraction failure with canned fallback, blob upload success, blob upload failure returning null. End-to-end Playwright tests SHALL also run against a configuration where `ANTHROPIC_API_KEY` is unset so the canned-data path is exercised in the integrated environment.

#### Scenario: A failing Anthropic API does not break the suite

- **GIVEN** the test for `extractInvoiceData` is configured to mock the Anthropic client
- **AND** the mock is set to throw a network error
- **WHEN** the test runs
- **THEN** the extraction service catches the error and returns canned fallback data
- **AND** the test asserts the canned fallback was returned
- **AND** no real network request is made

### Requirement: Each test is independently runnable

The system SHALL structure tests so that any single file or single test can be run in isolation and pass without depending on other tests for setup or state. The transactional reset pattern (or explicit truncate pattern for tests using `db.$transaction`) SHALL ensure no state leaks between tests.

#### Scenario: A single Playwright spec runs in isolation

- **GIVEN** the developer runs `npx playwright test tests/e2e/bill-lifecycle-full.spec.ts`
- **WHEN** only that file's tests execute
- **THEN** all tests in the file pass
- **AND** no test fails due to missing data created by another file's tests

### Requirement: A CI workflow runs the full suite on push

The system SHALL include a GitHub Actions workflow at `.github/workflows/test.yml` that runs the Vitest backend, Vitest component, and Playwright end-to-end suites on every push and pull request. The workflow SHALL provision a Postgres service container, apply the schema via `prisma db push`, and run all three test suites. Failures SHALL block the workflow.

#### Scenario: A pushed change with a failing test blocks the workflow

- **GIVEN** a change is pushed to a branch
- **AND** the change introduces a regression that breaks one Vitest test
- **WHEN** the GitHub Actions workflow runs
- **THEN** the test job fails
- **AND** the failure is visible on the pull request status check
