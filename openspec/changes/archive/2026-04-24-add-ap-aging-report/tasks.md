# Tasks: add-ap-aging-report

## Dependencies

- [x] No new packages required. All formatting helpers (`formatUSD`, date utilities) already exist.

## Service

- [x] Create `src/features/reports/report-service.ts`:
  - `import 'server-only';`
  - Exports `getApAgingReport(): Promise<ApAgingReport>`.
  - Defines `BucketKey = 'current' | 'd1to30' | 'd31to60' | 'd61plus'`.
  - Loads all outstanding bills (`status in [PENDING_APPROVAL, APPROVED, SCHEDULED]`) including vendor (id, name) — ordered by vendor name ascending.
  - Computes per-bill bucket via `classifyAge(dueDate, today)` using UTC start-of-day granularity.
  - Groups into `vendorRows` and computes `totals` and `billCount`.
  - Returns `{ asOf, vendorRows, totals, billCount }`.
- [x] Export the `ApAgingReport` type for router and UI consumption.

## Router

- [x] Create `src/features/reports/report-router.ts`:
  - `import 'server-only';`
  - `apAging` public query, delegates to `getApAgingReport()`.
- [x] Register `reportRouter` under `reports` in `src/server/root-router.ts`.

## Bucket pill component

- [x] Create `src/features/reports/components/aging-bucket-pill.tsx`:
  - Props: `{ bucket: BucketKey; value: string | number; }`.
  - Applies color classes based on bucket severity.
  - Named export only.

## Report component

- [x] Create `src/features/reports/components/ap-aging-report.tsx`:
  - Server Component.
  - Props: `{ data: ApAgingReport }`.
  - Header with "AP Aging Report" title + "as of {date}" right-aligned.
  - Four `<SummaryTile>` tiles (reused from dashboard) with bucket name, dollar sum, and bill count hint.
  - Table with vendor rows, empty state, and grand total footer.
  - Zero cells render as em-dash "—". Grand total row always shows numeric values.

## Page

- [x] Replace `src/app/reports/ap-aging/page.tsx`:
  - Server Component using `createCaller` to fetch `reports.apAging`.
  - `metadata.title = 'AP Aging Report — Settle'`.

## Seed

- [x] Updated `prisma/seed.ts` to spread bill dueDate values across aging buckets:
  - Marcus MLD-2024-047 (PENDING_APPROVAL, $650): due date pushed to -75 days → 61+ bucket.
  - Notion NTN-2024-0791 (APPROVED, $890): due date pushed to -45 days → 31–60 bucket.

## Verification

- [x] `npm run build` passes.
- [x] Navigate to `/reports/ap-aging`:
  - [x] Page title reads "AP Aging Report."
  - [x] "as of {today}" is displayed and matches today's date.
  - [x] Four summary tiles show bucket counts and amounts.
  - [x] Vendor table lists outstanding bills grouped by vendor.
  - [x] Amounts are formatted as USD with dollar sign and commas.
  - [x] Overdue buckets (31–60, 61+) render in red/amber.
  - [x] Grand total row at bottom sums correctly per bucket and overall.
- [x] Temporarily modify a seeded bill's `dueDate` to be 45 days in the past and re-seed. Reload — that bill should now appear in the 31–60 column. Revert.
- [x] Verify that DRAFT, PAID, and REJECTED bills do NOT appear in the report.
- [x] Deploy to Vercel. Walk the report page on the live URL.

## Definition of done

- All checkboxes above are ticked.
- The report looks like an accounting artifact, not a dashboard widget.
- Overdue severity is visible at a glance.
- `openspec validate --strict add-ap-aging-report` passes.
