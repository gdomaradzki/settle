# Tasks: refine-vendor-surfaces

## Dialog — add conditional fields

- [x] Update `src/features/vendors/components/add-vendor-dialog.tsx`:
  - Form schema accepts all vendor fields (`name`, `email`, `paymentMethod`, `defaultGlCategory`, `achAccountLast4`, `achRoutingLast4`, `mailingAddress`).
  - Validation: name required; ACH last 4 and routing last 4, when non-empty, must match `^\d{4}$`; email, when non-empty, must be valid.
  - Conditional rendering: watch `paymentMethod`. When ACH, render account + routing inputs. When CHECK, render mailing address textarea.
  - `defaultGlCategory` is always visible.
  - Use `shouldUnregister: false` on `useForm` so values persist across method toggles.
  - Submit payload includes all fields; empty strings sent as `undefined` or omitted so zod coerces them to null/undefined in the mutation input.

## Router — accept new fields

- [x] Update `vendor.create` input in `src/features/vendors/vendor-router.ts`:
  - Input schema accepts all fields from the dialog.
  - Prisma insert passes them through.

## Inbox filter — state

- [x] Update `src/features/bills/hooks/use-bill-filters.ts`:
  - Add `vendor` to the filter object, sourced from `?vendor=`.
  - Add `vendor` to the `setFilter` typing.
  - Clearing sets the param to null, which removes the query string.

## Inbox filter — UI

- [x] Update `src/features/bills/components/bills-filter-sidebar.tsx`:
  - Add a "Vendor" section below the existing filters.
  - Fetch vendors via `trpc.vendor.list.useQuery()`.
  - Render a native `<select>` with options: "Any vendor" (default) + one option per vendor, alphabetical.
  - Selecting a vendor calls `setFilter('vendor', vendorId)`.
  - Selecting "Any vendor" calls `setFilter('vendor', null)`.

## Bill list — consume filter

- [x] Update `src/features/bills/components/bills-table.tsx` (or wherever the list query is invoked):
  - Pass `vendor: filters.vendor ?? undefined` → `vendorId` to the `trpc.bill.list` input.
- [x] Update `src/features/bills/bill-service.ts`'s `listBills`:
  - Accept an optional `vendorId` in the input.
  - When present, add `vendorId` to the Prisma `where` clause.
- [x] Update `src/features/bills/bill-router.ts`'s `list` input schema to include the optional `vendorId`.
- [x] Update `src/features/bills/schemas.ts` `ListBillsInput` to include optional `vendorId: z.string()`.

## Vendors table — clickable rows

- [x] Update `src/features/vendors/components/vendors-table.tsx`:
  - Each row is navigable to `/bills?vendor=<vendor.id>` via `useRouter().push()` on click.
  - Keyboard: `tabIndex={0}`, Enter triggers navigation.
  - Hover shows cursor pointer, subtle background tint.
  - Tooltip (or title attribute) reads "View outstanding bills" on row hover.

## Verification

- [x] `npm run build` passes.
- [x] Dialog — ACH vendor:
  - Open `/vendors`, click "+ Add vendor".
  - Default method is ACH; see name, email, GL category, account last 4, routing last 4 fields.
  - Enter name "Test ACH Vendor", account "9999", routing "1234".
  - Switch to Check — ACH fields hide, mailing address textarea appears. Account and routing values should persist in form state (not visible, but preserved if switched back).
  - Switch back to ACH — fields reappear with previous values.
  - Confirm. Vendor created with all entered fields persisted.
- [x] Dialog — Check vendor:
  - Open the dialog, switch to Check.
  - Enter name, mailing address "123 Main St, Anytown, USA 12345".
  - Confirm. Vendor created; Account column on the table shows the truncated address.
- [x] Validation:
  - ACH account last 4 as "abc" — inline error.
  - ACH account last 4 as "12345" — inline error (must be exactly 4 digits).
  - Submit with empty account last 4 while on ACH method — succeeds (optional).
- [x] Inbox vendor filter:
  - Open `/bills`. Sidebar shows a Vendor select below existing filters.
  - Select "Amazon Web Services". Table narrows to only AWS bills. URL shows `?vendor=<awsId>`.
  - Select "Any vendor". Filter clears; URL loses the param.
  - Direct-navigate to `/bills?vendor=<awsId>` — filter applies on load, select shows AWS.
- [x] Clickable vendor rows:
  - Open `/vendors`. Hover a row — cursor changes to pointer.
  - Click the AWS row. Browser navigates to `/bills?vendor=<awsId>` with AWS selected in the sidebar filter.
  - Keyboard: tab to a row, press Enter. Same navigation.
- [x] Deploy to Vercel. Repeat a subset of flows on the live URL.

## Definition of done

- All checkboxes above are ticked.
- Dialog handles both payment methods fully; no field goes unaskable.
- Vendor filter is round-trippable via URL.
- Clicking any vendor row opens the filtered inbox view.
- `openspec validate --strict refine-vendor-surfaces` passes.
