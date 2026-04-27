# Change: add-automated-tests

## Why

The project has no automated test coverage. Every behavior verification has been manual, which scales poorly and offers no regression protection. As the codebase moves toward something worth maintaining, the absence of tests becomes a real risk.

This change adds three layers of automated test coverage:

1. **Backend tests (Vitest)** for every tRPC procedure and the underlying service functions. The state machine, the aggregations, the services are all covered against a real test database.
2. **Component tests (React Testing Library)** for the meaningful UI components — forms with validation, tables with sort/filter behavior, dialogs, modals.
3. **End-to-end tests (Playwright)** covering the critical user flows from the browser's perspective.

## What Changes

- **ADDED** Vitest for backend and component testing. Configured with project's TypeScript paths and Prisma client.
- **ADDED** React Testing Library + jsdom for rendering React components in Vitest.
- **ADDED** Playwright for end-to-end browser tests against a running dev server.
- **ADDED** `src/test/setup.ts` — global Vitest setup. A test database connection, a transactional reset pattern for read-only tests, an explicit-cleanup pattern for tests calling `db.$transaction`.
- **ADDED** `src/test/factories.ts` — typed factories for Users, Vendors, Bills, BillEvents, BillLineItems.
- **ADDED** `playwright.config.ts` — runs against a dev server with a seeded test database.
- **ADDED** `tests/e2e/` — Playwright test files for critical flows.
- **ADDED** test files colocated with the code they test under `src/features/<domain>/__tests__/`.
- **ADDED** scripts in `package.json`: `test`, `test:watch`, `test:coverage`, `test:e2e`, `test:all`.
- **ADDED** `.github/workflows/test.yml` — CI pipeline with Postgres service container running both Vitest and Playwright suites on every push.
- **ADDED** README "Running tests" section.

## Impact

- Every backend procedure has executable verification.
- The bill state machine — the load-bearing invariant — has comprehensive coverage of every transition, threshold branch, invalid-source case, and authorization rejection.
- Critical UI flows are covered end-to-end: intake → approval → schedule → pay; CSV bulk; reports load.
- CI runs the full suite on every push, blocking regressions at PR-time.
- Test runtime: ~30s for backend + component, ~2min for Playwright. Total ~2.5 minutes per CI run.
- Doubles the project's file count. The test directory becomes a meaningful part of the repository.
- No runtime behavior changes, no schema changes, no user-visible changes.

## Success criteria

- `npm test` runs Vitest backend + component tests, exits 0.
- `npm run test:e2e` starts a dev server with a seeded test DB and runs Playwright, exits 0.
- `npm run test:coverage` reports >85% line coverage on `src/features/*/`.
- Every router procedure (every `.query` and `.mutation` defined under any `*-router.ts`) has at least one test exercising the happy path.
- Authorization-gated procedures additionally have at least one test for the rejection path.
- The bill state machine has tests covering: all five transitions, both threshold branches on submit, every invalid-source-status case, authorization rejections, and atomicity (forced mid-transaction failure).
- Critical UI components have RTL coverage: the bill intake form, the duplicate-bill modal, the vendor combobox, the add-vendor dialog, the bills table, the filter sidebar, the AP aging report, the dashboard tiles.
- Playwright covers the core demo flows: PDF intake → approval → schedule → pay, manual intake, CSV bulk, vendor creation (both entry points), aging report renders correctly with seeded data.
- GitHub Actions workflow runs all suites on push and PR.
- Tests are independently runnable: any single file can run alone via `vitest run path/to/file` and pass.
