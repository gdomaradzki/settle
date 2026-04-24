# Change: add-bill-inbox

## Why

The inbox at `/bills` is the hero screen of the product. Every other screen orbits it: the dashboard's tiles deep-link into filtered inbox views, the detail page is reached by clicking an inbox row, and intake flows dump new bills back into it. It's also the screen an evaluator spends the most time on when judging product taste — the filters, the density, the status pills, and how the screen feels with realistic data.

This change replaces the placeholder at `/bills` with a full, filterable, searchable list of bills.

## What changes

- **ADDED** `src/app/bills/page.tsx` — the inbox route, a Server Component that renders the shell and hydrates the client table with initial data.
- **ADDED** `src/features/bills/components/bills-table.tsx` — the table body, client component; reads filter state from URL search params and calls `trpc.bill.list`.
- **ADDED** `src/features/bills/components/bills-filter-sidebar.tsx` — left sidebar with status filter, due-date window filter, and a "needs my approval" toggle.
- **ADDED** `src/features/bills/components/bill-status-pill.tsx` — reusable status pill, used here and later on the detail page.
- **ADDED** `src/features/bills/components/bills-search.tsx` — debounced search input bound to the URL `?q=` param.
- **ADDED** `src/features/bills/hooks/use-bill-filters.ts` — reads/writes filter state from URL search params using `useSearchParams` and `useRouter`.
- **ADDED** `src/lib/money.ts` — `formatUSD(cents)` helper. First use site.
- **ADDED** `src/lib/dates.ts` — `formatRelativeDueDate(dueDate)` returning strings like "Overdue 3d", "Due today", "Due in 5d". First use site.
- **ADDED** shadcn primitives used here (if not already installed): `table`, `badge`, `input`, `select`, `separator`.

## Impact

- First real screen in the product. Subsequent changes (`add-bill-detail`, `add-dashboard`) reuse the status pill and money/date formatters introduced here.
- Establishes the URL-as-state pattern for filters — subsequent filterable screens (the aging report) will follow the same convention.
- No schema changes, no new mutations. Read-only surface over the existing `trpc.bill.list` query.

## Success criteria

- `/bills` renders a table with all 14 seeded bills by default, ordered by due date ascending.
- Each row shows: status pill, vendor name, invoice number (if present), amount (formatted as USD), due date with relative indicator, and last-updated timestamp.
- Filter sidebar: selecting a status narrows the table to that status; selecting "Due this week" narrows to bills due within 7 days; toggling "Needs my approval" narrows to PENDING_APPROVAL bills (and returns empty when the current user is a SUBMITTER).
- Search input matches against vendor name and invoice number, debounced 200ms. Typing "Latham" narrows to the Latham & Watkins bill.
- All filter state is reflected in the URL (`?status=PENDING_APPROVAL&q=latham`); refreshing the page preserves the view.
- Empty state renders when filters match no bills: a minimal "No bills match these filters" block with a "Clear filters" button.
- Clicking a row navigates to `/bills/[id]`. The detail page is not implemented in this change; a 404 here is acceptable (verified by the router, not the page).
- No horizontal scroll on a 1280px viewport with realistic data.
- Overdue bills visually distinct (red/warning tint on the due-date column, not on the whole row).
- `npm run build` passes. Vercel deploy works.
