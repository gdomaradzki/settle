# Design: add-automated-tests

## Three test layers, three different jobs

**Vitest + real Postgres → backend.** Service functions and tRPC procedures run against a Postgres test database via Prisma. Real SQL, real constraints, real transactions. Catches the bugs that mocks miss.

**Vitest + jsdom + RTL → components.** Individual React components render in a virtual DOM. Tests verify what users see and how components respond to interaction. Fast (no real browser). Doesn't catch routing, real network, or visual regressions.

**Playwright → end-to-end.** A real Chromium browser drives the full app against a dev server with a seeded DB. Tests verify user journeys actually work. Slower but tests the integrated thing.

These are complementary, not redundant. A bug caught by an end-to-end test usually means at least one missing unit test. A bug caught by a unit test rarely surfaces in end-to-end because they cover too much per test.

## Test database: Docker locally, GitHub Actions service in CI

Both environments use plain Postgres.

**Locally:**

```bash
docker run -d --name settle-test-db -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16
```

Port 5433 to avoid colliding with any local Postgres running on the default port. The README documents this.

`.env.test` (gitignored) contains:

```
TEST_DATABASE_URL=postgresql://postgres:test@localhost:5433/test
```

**In CI:** GitHub Actions ships a Postgres service container alongside the test job:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

CI uses port 5432 directly because there's no local Postgres to collide with. The connection string is set in the workflow env.

Both environments run `prisma db push --schema ./prisma/schema.prisma` against the test DB before tests start, in a `globalSetup` hook. This applies the schema fresh each test run.

## Test isolation patterns

Two patterns coexist:

**Transactional reset for read-only tests:**

```ts
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});
afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

Tests opening their own transactions can't use this. Prisma's `$transaction` doesn't nest cleanly inside an outer transaction.

**Explicit cleanup for tests that call `$transaction`:**

```ts
afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "BillEvent", "BillLineItem", "Bill", "Vendor", "User" RESTART IDENTITY CASCADE',
  );
});
```

State-machine tests use this pattern because every transition opens its own transaction. Slower per test (~50ms vs ~10ms) but works correctly.

`src/test/setup.ts` exports both helpers; tests opt into whichever they need.

## Factories

`src/test/factories.ts` exports typed factories with sensible defaults:

```ts
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
  return prisma.user.create({
    data: {
      name: "Test User",
      email: `test-${randomUUID()}@example.com`,
      role: "SUBMITTER",
      ...overrides,
    },
  });
}
```

Tests then read like:

```ts
const submitter = await createTestUser();
const approver = await createTestUser({ role: "APPROVER" });
const vendor = await createTestVendor();
const bill = await createTestBill({
  vendorId: vendor.id,
  status: "PENDING_APPROVAL",
});
```

Factories handle the boring boilerplate. Tests focus on the behavior under test.

## Backend test scope

Every router (one test file per router, ~5-7 files):

- `bill-router.test.ts`
- `vendor-router.test.ts`
- `user-router.test.ts`
- `intake-router.test.ts`
- `report-router.test.ts`
- `dashboard-router.test.ts`

Every service that contains real logic (~5 files):

- `bill-service.test.ts` — the comprehensive state-machine file
- `report-service.test.ts` — bucketing logic
- `dashboard-service.test.ts` — aggregation logic
- `extract-invoice-data.test.ts` — Anthropic mock + canned fallback
- `store-invoice-pdf.test.ts` — Vercel Blob mock

Each router file: 1 happy-path test per procedure, plus 1 rejection-path test where authorization or validation matters. Average 4-6 tests per file. Total: ~50 backend tests.

The bill state machine is the exception — it gets ~15 tests by itself because it's the load-bearing invariant.

## Component test scope

Components worth testing in isolation (~10 files):

- `bill-intake-form.test.tsx` — validation rules (line items sum, due >= issue), auto-sum behavior, vendor selection.
- `duplicate-bill-modal.test.tsx` — strong vs soft match rendering, button states.
- `vendor-combobox.test.tsx` — search filtering, sticky create button, empty state, auto-select after create.
- `add-vendor-dialog.test.tsx` — conditional fields per method, validation, duplicate-name handling.
- `bills-table.test.tsx` — sortable columns, status pill rendering, overdue indicator excludes terminal statuses.
- `bills-filter-sidebar.test.tsx` — filter changes update URL, "Any vendor" clears.
- `ap-aging-report.test.tsx` — bucket coloring, em-dash for zero cells, grand-total row.
- `dashboard-view.test.tsx` — role-gated tile rendering.
- `csv-preview-table.test.tsx` — valid/invalid row badges, error message rendering.
- `bill-status-pill.test.tsx` — color per status.

Average 4-6 tests per file. Total: ~50 component tests.

Components NOT tested in isolation: pure presentational components (avatars, layout primitives), wrapper components that pass data through. These get exercised by end-to-end tests and the surrounding component tests.

## Playwright test scope

End-to-end flows that exercise complete user journeys (~12 files):

- `auth-and-roles.spec.ts` — user switcher works, role-gated UI shows/hides correctly.
- `bill-intake-pdf.spec.ts` — upload PDF, fill form, submit, land on detail.
- `bill-intake-manual.spec.ts` — manual entry path.
- `bill-lifecycle-full.spec.ts` — submit → approve (as Ada) → schedule → pay end-to-end.
- `bill-lifecycle-reject.spec.ts` — submit → reject (as Ada) → assert REJECTED state.
- `bill-lifecycle-auto-approve.spec.ts` — under-threshold submit auto-approves.
- `csv-bulk-upload.spec.ts` — drop sample CSV, preview, confirm, see new bills.
- `dashboard.spec.ts` — tiles render with correct data, tile clicks navigate to filtered inbox.
- `ap-aging-report.spec.ts` — report renders with all four buckets populated.
- `vendor-creation-from-vendors-page.spec.ts` — add vendor from `/vendors`.
- `vendor-creation-from-intake.spec.ts` — add vendor inline from intake combobox, auto-selects.
- `inbox-filters-and-sort.spec.ts` — filter combinations, URL persistence, column sorting.

Average 3-5 tests per file. Total: ~50 end-to-end tests.

Each Playwright test starts from a known seeded state. The `globalSetup` runs `db:push` + `db:seed` against the test DB once at suite start, then individual tests do their work without further seeding.

Mobile viewport coverage is limited: `inbox-filters-and-sort.spec.ts` and `auth-and-roles.spec.ts` include mobile-viewport variants for the filter sheet and the avatar-only top bar respectively. Other tests stick to desktop.

## Mocks

External services that real test runs don't actually call:

**Anthropic SDK** — mocked in `extract-invoice-data.test.ts` via `vi.mock('@anthropic-ai/sdk')`. Tests verify:

- Canned fallback when key is unset.
- Canned match when key is unset and filename matches a known sample.
- Default empty values when key is unset and filename doesn't match.
- Successful extraction returns `InvoiceExtractionSchema`-valid output.
- Schema validation failure falls back to canned data.

**Vercel Blob SDK** — mocked. Tests verify:

- Successful upload returns a URL string matching the expected pattern.
- Upload failure (mocked throw) returns null and doesn't throw.
- Missing token returns null.

For Playwright tests, the deployed dev server runs against the test DB. The Anthropic key is intentionally unset in CI so extraction uses canned data — Playwright tests assert the canned-data path renders correctly. The real-extraction path is covered only in unit tests.

## Coverage targets and exclusions

`>85%` line coverage on `src/features/*/`.

Excluded:

- `src/lib/` — formatting helpers; visible failures in any consumer test if these break.
- Generated Prisma client.
- `*.tsx` files (RTL covers component behavior; line coverage on JSX is misleading).
- The seed script — deterministic, breaks loudly if wrong.

## CI workflow

`.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      TEST_DATABASE_URL: postgresql://postgres:test@localhost:5432/test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx prisma db push --schema ./prisma/schema.prisma
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

Single job because the test DB needs to be shared. Two jobs would require two DB containers, and the marginal CI time saved isn't worth the complexity for a project this size.

## What this change does not do

- **No load tests, no performance benchmarks.**
- **No accessibility audits beyond what RTL exposes via `getByRole`.** A real `axe-core` integration is a separate concern.
- **No visual regression tests** (Playwright screenshot comparisons, Chromatic). High-maintenance for the value at MVP scale.
- **No tests against real Anthropic API or real Vercel Blob.** Both are mocked everywhere. A real-network smoke test belongs in a separate "integration" tier we're not building.
- **No flake detection or retry strategy in Playwright config.** Standard config; if a test is flaky it gets fixed, not retried.
- **No tests for the seed script.** Any test failing because the seed broke is sufficient signal.
- **No browser coverage beyond Chromium.** Firefox and WebKit can be added later if cross-browser issues surface.
- **No mobile-only flows beyond two test files.** Mobile-specific UX is covered as a variant in those files; full mobile flow coverage would double the Playwright count.
