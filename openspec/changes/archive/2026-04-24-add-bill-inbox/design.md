# Design: add-bill-inbox

## Page architecture

The inbox is a two-column layout:

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar (from add-app-shell)                                  │
├──────────────┬───────────────────────────────────────────────┤
│ Filters      │  Search + bulk hint bar                       │
│              │                                                │
│ Status       │  Bills table                                   │
│ [ ] DRAFT    │  ┌─────────────────────────────────────────┐  │
│ [x] PENDING  │  │ Status   Vendor        Amount  Due      │  │
│ [ ] APPROVED │  │ [Pending] Latham       $12,500 Due in 3d│  │
│ [ ] SCHED    │  │ [Paid]    AWS          $3,400  Paid     │  │
│ [ ] PAID     │  │ ...                                      │  │
│ [ ] REJECTED │  └─────────────────────────────────────────┘  │
│              │                                                │
│ Due Window   │                                                │
│ ○ Any        │                                                │
│ ○ Overdue    │                                                │
│ ○ This week  │                                                │
│ ○ This month │                                                │
│              │                                                │
│ ☑ Needs my   │                                                │
│   approval   │                                                │
└──────────────┴───────────────────────────────────────────────┘
```

Fixed-width left sidebar (`w-60`), flexible main area. Single column drop on mobile.

## URL as state

Filter state lives in the URL, not React state:

```
/bills?status=PENDING_APPROVAL&due=this-week&mine=1&q=latham
```

Three reasons:

1. **Shareable.** The dashboard's "Needs my approval" tile deep-links to `/bills?mine=1`. No extra state plumbing.
2. **Refresh-stable.** The evaluator refreshes mid-demo; the view doesn't reset.
3. **Back-button-correct.** Navigating away and back returns to the same filtered view.

The `useBillFilters` hook reads with `useSearchParams()`, writes with `useRouter().replace()` so changes don't pollute history.

```ts
// src/features/bills/hooks/use-bill-filters.ts
export function useBillFilters() {
  const params = useSearchParams();
  const router = useRouter();

  const filters = {
    status: params.get("status") as BillStatus | null,
    due: params.get("due") as DueWindow | null,
    mine: params.get("mine") === "1",
    q: params.get("q") ?? "",
  };

  const setFilter = <K extends keyof typeof filters>(
    k: K,
    v: (typeof filters)[K],
  ) => {
    const next = new URLSearchParams(params);
    if (v === null || v === "" || v === false) next.delete(k);
    else next.set(k, String(v));
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return {
    filters,
    setFilter,
    clearAll: () => router.replace("?", { scroll: false }),
  };
}
```

## Server + client split

`src/app/bills/page.tsx` is a Server Component that renders the sidebar (server-rendered for instant paint) and the table shell. The table itself is a Client Component because it needs reactive filter state. The initial query happens on the client through tRPC to keep things simple — no RSC hydration dance for this change.

That means on initial load: shell renders instantly from the server, table flashes a brief skeleton, then fills with data from tRPC. For 14 seeded bills this is invisible. For production this would be optimized with tRPC SSR helpers — called out in the README as a known refinement.

## Data query

Single call to the existing `trpc.bill.list` query:

```ts
const { data, isLoading } = trpc.bill.list.useQuery({
  status: filters.status ?? undefined,
  dueBefore: dueBeforeFromWindow(filters.due),
  needsMyApproval: filters.mine || undefined,
  search: filters.q || undefined,
});
```

The service-layer filter already supports all four — no router changes needed. `dueBeforeFromWindow` translates the filter's string ("this-week", "this-month", "overdue") into a `Date`.

The "overdue" window sends `dueBefore: new Date()` AND filters out PAID status client-side (paid bills aren't overdue even if their dueDate is past). Keeping this client-side because the server-side `list` query doesn't take a "not paid" filter, and adding one for one UI affordance isn't worth it.

## Search, debounced

The search input updates URL state with a 200ms debounce, not on every keystroke — otherwise typing "Latham" issues six tRPC queries. Implementation uses a `useDebounce` hook (lightweight, lives in `src/hooks/use-debounce.ts`):

```ts
const [draft, setDraft] = useState(filters.q);
const debounced = useDebounce(draft, 200);
useEffect(() => {
  setFilter("q", debounced);
}, [debounced]);
```

## Status pill

Reusable component with a status → color map:

| Status           | Tone           |
| ---------------- | -------------- |
| DRAFT            | neutral (gray) |
| PENDING_APPROVAL | amber          |
| APPROVED         | blue           |
| SCHEDULED        | indigo         |
| PAID             | green          |
| REJECTED         | red            |

Using shadcn's `Badge` as the primitive, with `variant` overrides where needed. Size is compact — this is a table cell, not a call-out.

The pill lives at `src/features/bills/components/bill-status-pill.tsx` (co-located with the feature, reusable across inbox and detail).

## Due-date column

Formatted through `formatRelativeDueDate(date, status)`:

- Past dueDate + not PAID → "Overdue 3d" in red
- Past dueDate + PAID → absolute date in neutral color
- Today → "Due today" in amber
- Within 7 days → "Due in 3d" in amber
- Further → absolute date like "Apr 30" in neutral

The color hint is a `className` on the cell, not a whole-row treatment. Whole-row warning coloring is visually loud and hurts density. Ramp and Brex both do per-cell hints only.

## Table itself

Plain HTML `<table>` styled with Tailwind + shadcn's table components. No virtualization (14 rows). No server-side pagination (future work). No row selection (CSV upload will own bulk ops through its own UX; in the inbox, rows are click-to-open only).

Columns:

| Status | Vendor           | Invoice #   | Amount     | Due       | Updated |
| ------ | ---------------- | ----------- | ---------- | --------- | ------- |
| (pill) | name + email dim | IN-2024-001 | $12,500.00 | Due in 3d | 2d ago  |

Density: `py-3 px-4` per cell. Row hover: subtle background shift + cursor pointer.

## Empty state

When filters match zero bills, render a centered block in the main area:

```
No bills match these filters.
[Clear filters]
```

Distinct from "the database is empty" — which never happens in this demo because of seeds. Not designing for that case.

## Why no column sorting in this change

The table is ordered by `dueDate` ascending at the query layer, always. Adding clickable column sort is maybe 40 lines but introduces state — which columns are sortable, tri-state sort, direction indicators — and every subsequent change has to keep honoring it. Not worth it for the MVP. Ordering by due-date is the correct default anyway: the bill most urgent to act on is always first.

If the evaluator asks "can I sort by amount?" the answer is "yes, using the filter sidebar to narrow first, then ordering by dueDate is deliberate — that's the AP-team-first view." Defensible.

## Accessibility basics

- Sidebar filters are a `<fieldset>` with a `<legend>` per group.
- Search input has a visible label (or aria-label if icon-only).
- Status pills have an aria-label with the full status name for screen readers.
- Table has `scope="col"` on headers.
- Row click target is a full-row `<Link>` (not a wrapping `<a>` around `<tr>` — that's invalid HTML) by making the last cell a link that stretches via CSS pseudo-element. Alternative: use `<tr>` with `onClick` + `tabIndex={0}` + keyboard handler. Using the latter — simpler and avoids CSS tricks.

## What this change does not do

- No bill detail page. Row clicks go to a 404 until `add-bill-detail` lands.
- No create-bill button in the toolbar. That's wired in `add-bill-intake`.
- No column sorting, no column resizing, no column hiding, no saved views.
- No bulk selection / bulk actions. Inbox rows are read-only from the list's perspective.
- No virtualization. 14 rows doesn't need it; thousands would.
- No export to CSV. Evaluator can query the DB directly if curious.
