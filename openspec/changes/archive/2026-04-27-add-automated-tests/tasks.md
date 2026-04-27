# Tasks: add-automated-tests

## Setup

- [ ] Install dev dependencies: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`.
- [ ] Add `vitest.config.ts` with TypeScript path resolution matching the project's `tsconfig.json`. Configure two projects: a `node` project for backend tests, a `jsdom` project for component tests.
- [ ] Add `playwright.config.ts` with `webServer` configured to start `npm run dev` against the test DB before running tests.
- [ ] Add scripts to `package.json`:
  - `test`: runs Vitest backend + component tests.
  - `test:watch`: Vitest in watch mode.
  - `test:coverage`: Vitest with coverage report.
  - `test:e2e`: Playwright tests.
  - `test:all`: runs both.
- [ ] Create `.env.test` (gitignored) with `TEST_DATABASE_URL=postgresql://postgres:test@localhost:5433/test` for local Docker setup.
- [ ] Document the local Docker command for the test DB in the README (`docker run -d --name settle-test-db -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16`).

## Test infrastructure

- [ ] Create `src/test/setup.ts`:
  - Instantiates `PrismaClient` against `TEST_DATABASE_URL`.
  - Exports the prisma instance and two reset helpers: `resetWithTransaction()` (for read-only tests) and `resetWithTruncate()` (for tests calling `db.$transaction`).
  - Comment block at top documenting why both patterns coexist.
- [ ] Create `src/test/factories.ts`:
  - `createTestUser(overrides?)` — User with defaults; unique email via `randomUUID()`.
  - `createTestVendor(overrides?)` — Vendor with default ACH method, unique name.
  - `createTestBill(overrides?)` — Bill in DRAFT with one EXPENSE line item.
  - `createTestBillEvent(billId, type, overrides?)`.
  - All factories return the created row.
- [ ] Create `src/test/global-setup.ts` for Vitest:
  - Runs `prisma db push` against `TEST_DATABASE_URL` once before any tests run.
- [ ] Create `tests/e2e/global-setup.ts` for Playwright:
  - Runs `prisma db push` and the seed script against the test DB before the dev server starts.

## Backend service tests

- [ ] `src/features/bills/__tests__/bill-service.test.ts`:
  - 6 transition tests (submit under threshold, submit at threshold, approve, reject, schedule, pay).
  - BillEvent count and payload assertions for each transition.
  - Lifecycle timestamp assertions.
  - 4+ invalid-transition tests.
  - 2+ authorization tests.
  - 1 atomicity test (forced mid-transaction failure).
- [ ] `src/features/reports/__tests__/report-service.test.ts`:
  - Bills at -10d, +15d, +45d, +75d overdue all bucket correctly.
  - PAID, REJECTED, DRAFT bills excluded.
  - Vendor grouping with multi-bucket vendor.
  - Grand total accuracy.
- [ ] `src/features/dashboard/__tests__/dashboard-service.test.ts`:
  - Needs-my-approval is 0 for SUBMITTER, accurate for APPROVER.
  - Due-this-week excludes past-due, includes 1-7 days.
  - Cash-out-30-days sums APPROVED + SCHEDULED only.
  - Recent activity ordered by createdAt desc, limit 8.
- [ ] `src/features/intake/__tests__/extract-invoice-data.test.ts`:
  - Mocked Anthropic SDK.
  - Canned fallback when no key.
  - Canned match by filename.
  - Empty defaults for unknown filenames.
  - Successful real extraction returns valid `InvoiceExtraction`.
  - Schema validation failure falls back.
- [ ] `src/features/intake/__tests__/store-invoice-pdf.test.ts`:
  - Mocked Vercel Blob.
  - Successful upload returns URL.
  - Failed upload returns null without throwing.
  - Missing token returns null.

## Backend router tests

- [ ] `src/features/bills/__tests__/bill-router.test.ts`:
  - `list` query: returns bills, applies status/due/vendor/sort filters.
  - `get` query: returns by id, throws NOT_FOUND.
  - `create`, `submit`, `approve`, `reject`, `schedule`, `pay` mutations: happy path + at least one rejection path each.
  - `createAndSubmit`, `createMany`, `findPotentialDuplicates`.
- [ ] `src/features/vendors/__tests__/vendor-router.test.ts`:
  - `list` returns with outstanding aggregates, alphabetical.
  - `create` succeeds with valid input.
  - `create` rejects case-insensitive duplicate name.
- [ ] `src/features/users/__tests__/user-router.test.ts`:
  - `list` returns all users.
  - `current` returns user from context.
- [ ] `src/features/intake/__tests__/intake-router.test.ts`:
  - `extractFromPdf` returns `{ extraction, pdfUrl }` shape.
- [ ] `src/features/reports/__tests__/report-router.test.ts`:
  - `apAging` returns the bucketed report with correct totals.
- [ ] `src/features/dashboard/__tests__/dashboard-router.test.ts`:
  - `summary` returns the four metrics correctly.

## Component tests (RTL)

- [ ] `src/features/intake/components/__tests__/bill-intake-form.test.tsx`:
  - Validation: line items must sum to amount.
  - Validation: due date >= issue date.
  - Auto-sum: line item changes update bill amount until user manually edits.
  - Vendor selection: combobox prefills from extraction match.
  - Form submission triggers correct mutation.
- [ ] `src/features/intake/components/__tests__/duplicate-bill-modal.test.tsx`:
  - Strong matches render with red header.
  - Soft matches render with amber header.
  - Cancel button fires onCancel; Save anyway fires onProceed.
- [ ] `src/features/intake/components/__tests__/vendor-combobox.test.tsx`:
  - Search filters the visible list.
  - "+ Create new vendor" sticky at bottom.
  - Empty state renders with breathing room.
  - Newly-created vendor auto-selects.
- [ ] `src/features/vendors/components/__tests__/add-vendor-dialog.test.tsx`:
  - ACH method shows account + routing fields.
  - Check method shows mailing address.
  - Toggling method preserves entered values.
  - Duplicate name shows inline error.
- [ ] `src/features/bills/components/__tests__/bills-table.test.tsx`:
  - Sortable columns toggle direction on click.
  - Status pill renders correct color per status.
  - Overdue indicator excludes PAID and REJECTED.
- [ ] `src/features/bills/components/__tests__/bills-filter-sidebar.test.tsx`:
  - Filter changes update URL.
  - "Any vendor" clears the filter.
- [ ] `src/features/reports/components/__tests__/ap-aging-report.test.tsx`:
  - Bucket coloring matches severity.
  - Zero cells render em-dash.
  - Grand total row sums correctly.
- [ ] `src/features/dashboard/components/__tests__/dashboard-view.test.tsx`:
  - Tile values render correctly.
  - Tile click navigates to filtered inbox URL.
- [ ] `src/features/intake/components/__tests__/csv-preview-table.test.tsx`:
  - Valid rows show Valid badge.
  - Invalid rows show inline error message.
  - Confirm button disabled until all rows valid.
- [ ] `src/features/bills/components/__tests__/bill-status-pill.test.tsx`:
  - Color per status.

## End-to-end tests (Playwright)

- [ ] `tests/e2e/auth-and-roles.spec.ts`:
  - User switcher toggles between Gus and Ada.
  - Approve button visible only to APPROVER on PENDING_APPROVAL bills.
  - Mobile viewport: top bar shows avatar only.
- [ ] `tests/e2e/bill-intake-pdf.spec.ts`:
  - Upload PDF, extraction completes, form fills, submit lands on detail.
- [ ] `tests/e2e/bill-intake-manual.spec.ts`:
  - Manual entry without PDF, save as draft, see in inbox.
- [ ] `tests/e2e/bill-lifecycle-full.spec.ts`:
  - Submit (over threshold) as Gus, switch to Ada, approve, switch back, schedule, pay. Timeline shows 5 events.
- [ ] `tests/e2e/bill-lifecycle-reject.spec.ts`:
  - Submit, reject with reason, assert REJECTED status and rejection reason in timeline.
- [ ] `tests/e2e/bill-lifecycle-auto-approve.spec.ts`:
  - Under-threshold bill auto-approves on submit.
- [ ] `tests/e2e/csv-bulk-upload.spec.ts`:
  - Drop sample CSV, see preview, confirm, see N new bills in inbox.
- [ ] `tests/e2e/dashboard.spec.ts`:
  - Tile values match seed.
  - Click tile navigates to filtered inbox.
- [ ] `tests/e2e/ap-aging-report.spec.ts`:
  - Report loads with all four buckets populated from seed.
  - Vendor row shows correct multi-bucket amounts.
- [ ] `tests/e2e/vendor-creation-from-vendors-page.spec.ts`:
  - Add vendor via dialog on `/vendors`, see in table.
- [ ] `tests/e2e/vendor-creation-from-intake.spec.ts`:
  - Add vendor inline from intake combobox, auto-selects on form.
- [ ] `tests/e2e/inbox-filters-and-sort.spec.ts`:
  - Filter combinations work, URL reflects state.
  - Column sort toggles direction, URL persists.
  - Mobile viewport: filter sheet opens via Filters button.

## CI

- [ ] Create `.github/workflows/test.yml`:
  - Postgres service container.
  - `prisma db push` to set up schema.
  - `npm test` for Vitest.
  - `playwright install` for browser binaries.
  - `npm run test:e2e` for Playwright.
- [ ] Verify the workflow runs green on a sample push.

## Coverage and documentation

- [ ] Run `npm run test:coverage`. Verify >85% line coverage on `src/features/*/`. Add targeted tests where any feature directory falls below.
- [ ] Update README with a "Running tests" section:
  - Local Docker setup command.
  - How to run each test suite.
  - Note on the GitHub Actions workflow.

## Verification

- [ ] `npm test` exits 0 with all Vitest tests passing.
- [ ] `npm run test:coverage` reports >85% on `src/features/*/`.
- [ ] `npm run test:e2e` exits 0 against a freshly-seeded test DB.
- [ ] Each test file runs alone via `vitest run path/to/file` without dependency on other files.
- [ ] No test pollutes the dev database.
- [ ] CI workflow runs green on push.

## Definition of done

- All checkboxes above are ticked.
- Backend, components, and end-to-end flows all have automated coverage.
- CI runs all suites on every push.
- README documents how to run tests.
- `openspec validate --strict add-automated-tests` passes.
