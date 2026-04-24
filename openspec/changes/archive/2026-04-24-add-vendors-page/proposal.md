# Change: add-vendors-page

## Why

The `/vendors` route is still the placeholder from the app-shell change — "Vendors coming soon." It's visible from the top bar nav and a dead-end in an otherwise complete product. An evaluator clicking through the nav will find it immediately, which undermines the "production-quality MVP" framing.

Vendors are supporting data, not the hero surface, so the page is minimal by design: a table of vendors and a button to add one. Drill-down and edit flows are out of scope.

## What Changes

- **ADDED** `src/app/vendors/page.tsx` — replaces the placeholder with the real vendors list page.
- **ADDED** `src/features/vendors/components/vendors-table.tsx` — the vendors table with a "+ Add vendor" button.
- **ADDED** `src/features/vendors/components/add-vendor-dialog.tsx` — a dialog for creating a new vendor, reusable across this page and the intake form's inline creation.
- **MODIFIED** `src/features/vendors/vendor-router.ts` — the existing `list` query now includes outstanding bill count and total owed per vendor.

## Impact

- Every route in the top bar nav now renders real content. No placeholders remain.
- The "add vendor" affordance is discoverable outside the intake flow — users who want to set up vendors before creating bills have a place to do it.
- Existing vendor data flows (intake form's combobox, bill detail's vendor display) are unchanged.
- No schema changes. No new mutations. The `vendor.create` mutation already exists from the intake change.

## Success criteria

- `/vendors` renders a table listing all seeded vendors.
- Each row shows: vendor name, payment method (ACH or Check), ACH last-4 or mailing address summary, default GL category if set, count of outstanding bills, total owed across those bills (USD).
- A "+ Add vendor" button in the toolbar opens a dialog with name, payment method, optional email. On confirm, creates the vendor via `vendor.create` and the table refetches.
- Empty vendor fields (no email, no mailing address) render as an em-dash, not "null" or blank.
- The page is a Server Component; the table is a Client Component for the dialog interaction.
- `npm run build` passes. Vercel deploy works.
