# Tasks: add-bill-inbox

## Dependencies

- [x] Install shadcn primitives if not already present: `npx shadcn@latest add table badge input select separator`.

## Formatting helpers

- [x] Create `src/lib/money.ts`:
  - Exports `formatUSD(cents: number): string` — returns e.g. `"$12,500.00"`.
  - Uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
  - Handles negative, zero, and large values.
- [x] Create `src/lib/dates.ts`:
  - Exports `formatRelativeDueDate(dueDate: Date, status: BillStatus): { label: string; tone: 'default' | 'warning' | 'overdue' | 'muted' }`.
  - Past + not PAID: `"Overdue 3d"`, tone `overdue`.
  - Past + PAID: absolute date, tone `muted`.
  - Today: `"Due today"`, tone `warning`.
  - Within 7 days future: `"Due in 3d"`, tone `warning`.
  - Further future: `"Apr 30"`, tone `default`.
  - Handles timezone by comparing at UTC-midnight granularity.

## Hooks

- [x] Create `src/hooks/use-debounce.ts`:
  - Exports `useDebounce<T>(value: T, delayMs: number): T`.
  - Uses `useEffect` + `setTimeout` + cleanup.
- [x] Create `src/features/bills/hooks/use-bill-filters.ts`:
  - Client-side hook (`'use client'` not needed — consumed by client components).
  - Reads `status`, `due`, `mine`, `q` from `useSearchParams()`.
  - Exposes `setFilter(key, value)` that uses `router.replace()` with `{ scroll: false }`.
  - Exposes `clearAll()` that navigates to `?`.

## Status pill

- [x] Create `src/features/bills/components/bill-status-pill.tsx`:
  - Props: `status: BillStatus`.
  - Renders shadcn `Badge` with a variant and label based on status.
  - Label humanized: "Pending approval" not "PENDING_APPROVAL".
  - Includes `aria-label` with the readable status.
  - Named export only.

## Search

- [x] Create `src/features/bills/components/bills-search.tsx`:
  - Client component.
  - Uses `useBillFilters` for state.
  - Local `draft` state updated on each keystroke, debounced 200ms before writing back to the URL.
  - shadcn `Input` with a magnifying-glass icon (lucide `Search`).
  - Placeholder: "Search by vendor or invoice number".

## Filter sidebar

- [x] Create `src/features/bills/components/bills-filter-sidebar.tsx`:
  - Client component.
  - Uses `useBillFilters`.
  - Three groups:
    - **Status**: radio group with options `Any`, `Draft`, `Pending approval`, `Approved`, `Scheduled`, `Paid`, `Rejected`. "Any" clears the filter.
    - **Due window**: radio group with options `Any`, `Overdue`, `Due this week`, `Due this month`.
    - **Quick filters**: a single checkbox `Needs my approval`.
  - "Clear all" button at the bottom when any filter is active.
  - Styled as a sidebar: `w-60 border-r` on desktop; stacks vertically on mobile.

## Bills table

- [x] Create `src/features/bills/components/bills-table.tsx`:
  - Client component.
  - Reads filters via `useBillFilters`.
  - Calls `trpc.bill.list.useQuery(...)` with filters mapped to the router input shape.
  - Handles three states:
    - **Loading**: shows a skeleton (6 rows of shimmering bars).
    - **Empty (after filters)**: renders the empty-state block with "Clear filters" button.
    - **Loaded**: renders the table.
  - Columns: Status, Vendor, Invoice #, Amount, Due, Updated.
  - Row click: navigates to `/bills/[id]` via `useRouter().push()`.
  - Row keyboard support: `tabIndex={0}`, Enter key triggers navigation.
  - Density: `py-3 px-4`, hover shows a subtle background shift.
  - Uses `formatUSD` and `formatRelativeDueDate` for formatting.

## Overdue logic helper

- [x] Create `src/features/bills/lib/overdue.ts`:
  - Exports `filterOverdue(bills): Bill[]` that drops PAID bills from a due-before-now query result.
  - Used by the bills-table component for the "Overdue" window filter.

## Page

- [x] Replace `src/app/bills/page.tsx` (currently a placeholder from `add-app-shell`):
  - Server Component.
  - Renders a two-column layout: `<BillsFilterSidebar />` + `<div className="flex-1">...</div>`.
  - Inside the main area: heading "Bills", `<BillsSearch />`, `<BillsTable />`.
  - Exports `metadata = { title: 'Bills — Settle' }`.

## Verification

- [x] `npm run build` passes.
- [x] `npm run dev` — navigate to `/bills`:
  - [x] Table renders with 14 rows, ordered by due date ascending.
  - [x] Top row should be the most overdue (or soonest due) bill, bottom row the furthest future.
  - [x] Status pills colored correctly for each status.
  - [x] Amounts display as e.g. `$12,500.00`.
  - [x] Overdue bills show "Overdue Xd" in red on the Due column.
  - [x] Due-this-week bills show "Due in Xd" in amber.
- [x] Filter interactions:
  - [x] Click `Pending approval` — table narrows to 3 rows. URL shows `?status=PENDING_APPROVAL`.
  - [x] Click `Overdue` — table narrows further if any pending bills are overdue; otherwise empty.
  - [x] Clear filters — back to 14 rows.
  - [x] Type "latham" into search — narrows to 1 row after 200ms. URL shows `?q=latham`.
  - [x] Refresh the page — filter state preserved.
  - [x] Click "Needs my approval" while Gus is active — table goes empty (Gus is SUBMITTER). Switch to Ada via top bar — table now shows 3 pending bills.
- [x] Empty state:
  - [x] Type nonsense into search like "asdfjkl" — empty state renders with "Clear filters" button. Click it — returns to default view.
- [x] Click any row — navigates to `/bills/[id]` (expected 404 for now; that's fine).
- [x] Responsive:
  - [x] Resize to ~768px — sidebar collapses to a toggle button; no horizontal scroll on the table.
- [x] Deploy to Vercel — live URL renders.

## Definition of done

- All checkboxes above are ticked.
- Filter state is fully in the URL; every filter works via direct URL entry.
- Visual density and spacing reads as restrained and professional (evaluator-test: would this fit in Ramp's UI with minor tweaks?).
- `openspec validate --strict add-bill-inbox` passes.
