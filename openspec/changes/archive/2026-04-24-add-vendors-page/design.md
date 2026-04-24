# Design: add-vendors-page

## Scope philosophy

This page is deliberately minimal. Vendors are supporting data — users spend almost no time on this surface relative to bills. Over-investing here steals time from the core flow without moving the evaluation needle. The bar is: the page exists, it's real, it works, and the nav link no longer dead-ends.

Explicitly out of scope for this change:

- Vendor detail page (clicking a row does nothing)
- Editing an existing vendor
- Deleting a vendor
- Filtering / sorting
- Bulk import

These are all reasonable features a real product needs. None are demo-critical.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Vendors                                     [+ Add vendor] │
│                                                              │
│  Name            Method  Account       GL       Outstanding │
│  Amazon Web Svcs ACH     ****4521      Infra    2 · $4,240  │
│  Latham & Watki. Check   NYC Mail Box  Legal    1 · $12,500 │
│  WeWork          ACH     ****1002      Real Est 0 · $0      │
│  ...                                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Header row with page title on the left, primary action button on the right — same pattern as the inbox.

## The outstanding-bills summary per vendor

Each row shows "2 · $4,240" meaning "2 outstanding bills totaling $4,240." Computed at query time:

```ts
// In vendor-router.ts, update list to include this
const vendors = await db.vendor.findMany({
  orderBy: { name: "asc" },
  include: {
    bills: {
      where: { status: { in: ["PENDING_APPROVAL", "APPROVED", "SCHEDULED"] } },
      select: { amountCents: true },
    },
  },
});

return vendors.map((v) => ({
  ...v,
  bills: undefined,
  outstandingCount: v.bills.length,
  outstandingCents: v.bills.reduce((s, b) => s + b.amountCents, 0),
}));
```

Same "outstanding" definition as the AP aging report — PENDING_APPROVAL, APPROVED, or SCHEDULED. PAID and REJECTED are excluded.

The column title is "Outstanding" — matches language used elsewhere in the product.

## Reusing the add-vendor dialog

The intake form already has an inline create-vendor dialog (from the `add-bill-intake` change). Two options:

1. **Extract it into a shared component** at `src/features/vendors/components/add-vendor-dialog.tsx` and have both the vendors page and the intake form use it.
2. **Duplicate it.**

Option 1 is correct. The intake form's inline dialog and the vendors page's toolbar dialog are the same thing at different entry points — one definition, one maintenance burden. The extraction is a small refactor; the intake form's import path changes.

## Account column formatting

Vendors can have either ACH (with `achAccountLast4`) or Check (with `mailingAddress`). The "Account" column renders differently based on method:

- ACH vendor: `****1234` (last 4 only, masked)
- Check vendor: First ~40 chars of mailing address, truncated with ellipsis
- Neither set: em-dash

Keeps the column consistent in shape while respecting that these two payment types carry different data.

## Page composition

`src/app/vendors/page.tsx` is a Server Component that:

1. Uses `createCaller` to fetch `vendor.list` with the outstanding summary.
2. Renders `<VendorsTable initialVendors={vendors} />`.

The table is a Client Component because the dialog's open/close state and mutation callbacks need client-side state. `initialVendors` seeds the `useQuery` hook so there's no loading flash on first render.

## Empty state

If the database has zero vendors (never happens after seeding), the table body shows "No vendors yet. Click '+ Add vendor' to create one." With seed data, this state is unreachable — but rendering the empty state costs one conditional branch and prevents a broken page if someone wipes the DB.

## What this change does not do

- No vendor detail route at `/vendors/[id]`.
- No editing existing vendors. If a vendor's ACH info changes, the only path today is to delete the DB row manually. Acceptable for MVP.
- No deletion. Vendors accumulate forever.
- No filters or search. 5-ish vendors in the demo; filters would be noise.
- No column sorting. Alphabetical by name, always.
- No pagination. Again, 5 vendors.
- No deep-link from a vendor row to `/bills?vendor=<id>`. That'd require adding a vendor filter to the inbox, which is scope creep.
