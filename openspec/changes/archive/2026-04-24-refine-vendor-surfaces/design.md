# Design: refine-vendor-surfaces

## Conditional fields in the vendor dialog

The dialog's field set branches on `paymentMethod`. Using react-hook-form's `watch` to drive conditional rendering:

```tsx
const method = watch("paymentMethod");
// Always visible: name, email, defaultGlCategory
// If method === 'ACH': achAccountLast4, achRoutingLast4
// If method === 'CHECK': mailingAddress
```

**Preserving form state across toggles.** When a user enters an ACH account number, then switches to Check, then back to ACH, the number should still be there. react-hook-form preserves field values by default when fields unregister — but to be safe, pass `shouldUnregister: false` to the dialog's `useForm`, or use `defaultValues` to hold all fields upfront.

**Validation per method:**

- `achAccountLast4` and `achRoutingLast4`: when present, must be exactly 4 digits. Empty string allowed (both are optional).
- `mailingAddress`: when method is CHECK and address is non-empty, no specific format (free text).

The zod schema handles the branching:

```ts
const VendorCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  paymentMethod: z.enum(["ACH", "CHECK"]),
  defaultGlCategory: z.string().optional(),
  achAccountLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("")),
  achRoutingLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("")),
  mailingAddress: z.string().optional(),
});
```

No cross-field refinement. A Check vendor could technically have ACH fields populated — the server just stores what's sent, and the Account column in the vendors table renders based on `paymentMethod` so the unused fields never surface.

## Vendor filter on the inbox

The filter lives in the existing sidebar between the existing filters. Implementation:

1. `use-bill-filters.ts` adds `vendor: string | null` to the filter object, reading from `?vendor=`.
2. The filter sidebar renders a select or combobox populated from `trpc.vendor.list`.
3. The bill list component passes `vendor` as `vendorId` into the `trpc.bill.list` query input.
4. `bill-service.ts`'s `listBills` adds `where.vendorId = filters.vendorId` when present.

**Shape of the vendor picker:** a shadcn `Select` (simple dropdown) is fine here because vendor count is small. Future-proofing with a combobox (`Command` + search) would be nice at 50+ vendors, but adds complexity not worth the scope cost. Simple dropdown.

Include an "Any vendor" option at the top that clears the filter — same UX as the Status and Due filters.

## Clickable vendor rows

On `/vendors`, each table row becomes a Link to `/bills?vendor=<id>`. Same pattern as the inbox's row-is-a-link approach — `<tr>` with `onClick` + keyboard handler, not a wrapping `<a>`.

Tooltip on hover: "View outstanding bills." Small UX affordance that explains the row is clickable.

## What this change does not do

- No vendor edit flow. The dialog remains create-only. Existing vendors' account info cannot be changed through the UI.
- No combobox search on the vendor filter — just a plain select.
- No drill-down from `/bills?vendor=<id>` into vendor details. The bills inbox shows what it always shows, just filtered.
- No "active filter pill" UI showing which vendor is selected. The sidebar's select shows the selected vendor's name, which is enough.
- No client-side sort of vendor filter options — server returns them alphabetically and the select respects that order.
