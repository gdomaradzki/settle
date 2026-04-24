# Change: refine-vendor-surfaces

## Why

Two related gaps surfaced after shipping `add-vendors-page`:

1. **Account info isn't captureable via the UI.** Seed vendors have ACH last-4 / routing / mailing address / default GL category, but the add-vendor dialog only collects name, method, and email. A user creating a vendor through the app ends up with an incomplete record.

2. **There's no way to filter bills by vendor.** The inbox has status and due-date filters, but vendor is a natural AP filter — "show me everything Amazon Web Services owes" — that's missing. Clicking a vendor row on `/vendors` also does nothing currently, which feels like a dead end.

Both are small. One change covers both.

## What Changes

- **MODIFIED** `src/features/vendors/components/add-vendor-dialog.tsx` — fields become conditional on payment method. Always visible: name, email, default GL category. When method is ACH: account last 4, routing last 4. When method is CHECK: mailing address.
- **MODIFIED** `src/features/vendors/vendor-router.ts` — `vendor.create` input schema accepts the new optional fields.
- **MODIFIED** `src/features/bills/bill-service.ts` — `listBills` accepts an optional `vendorId` filter.
- **MODIFIED** `src/features/bills/bill-router.ts` — `list` query exposes the new filter.
- **MODIFIED** `src/features/bills/hooks/use-bill-filters.ts` — adds `vendor` to the filter state, sourced from the `?vendor=<id>` URL param.
- **MODIFIED** `src/features/bills/components/bills-filter-sidebar.tsx` — adds a vendor select/combobox filter below existing filters.
- **MODIFIED** `src/features/vendors/components/vendors-table.tsx` — each row becomes clickable, navigating to `/bills?vendor=<id>`.

## Impact

- New vendors created via the app carry the same richness as seeded vendors.
- Users can navigate from a vendor to their bills in one click — closing the "what do I owe this vendor?" loop.
- No schema migration. All affected columns already exist on `Vendor`.
- No changes to the bill lifecycle, the intake flow, or the dashboard.

## Success criteria

- Opening the add-vendor dialog with method defaulted to ACH shows: name, email, GL category, account last 4, routing last 4.
- Switching method to CHECK hides the ACH fields and shows a mailing address textarea.
- Switching back to ACH restores the ACH fields with any previously entered values preserved in form state.
- Creating a vendor with all fields populated persists each field to the database.
- Creating a vendor with only name and method succeeds (all other fields optional).
- The inbox sidebar has a new "Vendor" filter — a combobox/select with every vendor. Selecting one filters the table; clearing returns to unfiltered.
- URL reflects the vendor filter as `?vendor=<id>`; navigating to that URL directly applies the filter.
- Clicking a vendor row on `/vendors` navigates to `/bills?vendor=<id>` with the inbox's vendor filter showing that vendor selected.
- `npm run build` passes. Vercel deploy works.
