# Change: add-ap-aging-report

## Why

The Accounts Payable Aging Report is a canonical AP artifact — every finance team runs one monthly to answer "which vendors are we owed money to, and how overdue is it?" It's the single most-recognizable report name in the category, and shipping it (even in a simple form) signals that the team understands how AP products are actually used.

The `/reports/ap-aging` route is already reachable from the top bar nav and currently renders a placeholder from `add-app-shell`. This change replaces the placeholder with a real report: outstanding bills bucketed by days-past-due, grouped by vendor, with totals.

## What Changes

- **ADDED** `src/app/reports/ap-aging/page.tsx` — replaces the placeholder with the real report page.
- **ADDED** `src/features/reports/components/ap-aging-report.tsx` — the report composition: summary band of bucket totals, then a grouped-by-vendor table.
- **ADDED** `src/features/reports/components/aging-bucket-pill.tsx` — small reusable pill showing a count or amount tinted by aging severity.
- **ADDED** `src/features/reports/report-router.ts` — tRPC router exposing an `apAging` query.
- **ADDED** `src/features/reports/report-service.ts` — server-only service that computes the bucketed report from the database.

## Impact

- The fourth primary nav link (`Reports`) now lands on something real. Every visible route in the top bar renders useful content.
- Closes the remaining placeholder in the app. Every route is production-quality.
- No schema changes, no new mutations. Pure derived read surface.
- Establishes the `reports` capability as a place for future reports (cash forecast, vendor spend by category, etc.) without introducing new infrastructure.

## Success criteria

- `/reports/ap-aging` renders a page titled "AP Aging Report."
- A summary band at the top shows four tiles: Current (not yet due), 1–30 days overdue, 31–60 days overdue, 61+ days overdue. Each tile shows a count of bills and a sum of amounts.
- Below the summary, a table lists outstanding bills grouped by vendor. Each row shows: vendor name, vendor totals per bucket, and the vendor's grand total.
- A bottom row shows grand totals across all vendors per bucket.
- "Outstanding" means status is PENDING_APPROVAL, APPROVED, or SCHEDULED. DRAFT bills are excluded (not committed). PAID and REJECTED bills are excluded (not outstanding).
- If a bucket has zero bills or zero dollars, the tile still renders showing "0" or "$0" — no hidden tiles.
- Aging severity is visually indicated on the 31–60 and 61+ buckets with increasing red intensity. Current and 1–30 are neutral / mild amber.
- `npm run build` passes. Vercel deploy works.
