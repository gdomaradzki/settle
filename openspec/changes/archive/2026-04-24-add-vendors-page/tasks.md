# Tasks: add-vendors-page

## Router extension

- [x] Update `src/features/vendors/vendor-router.ts`:
  - The existing `list` query now includes per-vendor `outstandingCount` and `outstandingCents`, computed by including bills with status in [PENDING_APPROVAL, APPROVED, SCHEDULED] and summing amountCents.
  - Strip the raw `bills` array from the response shape — only the aggregates are exposed.
- [x] Ensure the `vendor.create` mutation still exists and works as before (used by the dialog).

## Add-vendor dialog (shared)

- [x] Create `src/features/vendors/components/add-vendor-dialog.tsx`:
  - Client component.
  - Props: `{ open, onOpenChange, onCreated?, initialName? }`.
  - On confirm, calls `trpc.vendor.create.useMutation()`, invalidates `vendor.list`, fires `onCreated`, closes.
  - On error, shows a red toast.
- [x] Update the intake form's inline vendor creation to import and use this shared dialog (removed duplicate).

## Vendors table

- [x] Create `src/features/vendors/components/vendors-table.tsx`:
  - Client component.
  - Props: `{ initialVendors: VendorWithOutstanding[] }`.
  - `trpc.vendor.list.useQuery(undefined, { initialData })` for instant first render.
  - Toolbar: "Vendors" heading + "+ Add vendor" button opening the shared dialog.
  - Columns: Name, Method (badge), Account (masked/truncated), GL Category, Outstanding.
  - Empty state: "No vendors yet."

## Page

- [x] Replace `src/app/vendors/page.tsx`:
  - Server Component fetching `vendor.list` via `createCaller`.
  - `metadata.title = 'Vendors — Settle'`.

## Verification

- [x] `npm run build` passes.
- [x] Navigate to `/vendors`:
  - Table renders with 5 seeded vendors (or however many exist after prior demo usage).
  - Each row shows name, method badge, account summary, GL category, outstanding count and total.
  - ACH vendors show masked account numbers; Check vendors show a truncated address.
  - Vendors with zero outstanding bills show "0 · —".
- [x] Click "+ Add vendor":
  - Dialog opens with empty fields, method defaulted to ACH.
  - Enter name "Test Vendor", method Check, no email.
  - Click Create.
  - Dialog closes, table refreshes, new vendor appears in the list alphabetically.
- [x] Open the intake form at `/bills/new`, click vendor combobox, type a new name, click "+ Create new vendor".
  - Confirm the same dialog opens (shared component).
  - Create a vendor; confirm it shows both on the intake form and, when navigating to `/vendors`, in the table.
- [x] Navigate to `/bills`, open a bill from one of the vendors in the outstanding list. Confirm the detail page's vendor display works as before.
- [x] Deploy to Vercel and walk the flow on the live URL.

## Definition of done

- All checkboxes above are ticked.
- No placeholder content remains anywhere in the app.
- The add-vendor dialog is defined in one place and used from both entry points.
- `openspec validate --strict add-vendors-page` passes.
