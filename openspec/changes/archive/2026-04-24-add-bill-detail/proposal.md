# Change: add-bill-detail

## Why

The inbox lists bills but offers no way to act on one. The detail page at `/bills/[id]` is where the product's core value lands:

- A finance person reviews the full bill — line items, memo, the PDF — and approves, rejects, schedules, or pays.
- The activity timeline renders from `BillEvent`, giving every action a visible audit trail — this is the payoff for the events table that's been accumulating rows since the schema change.
- The approval handoff becomes a single clickable flow: submit as Gus → switch to Ada → approve → switch back → schedule → pay.

After this change, the end-to-end demo works.

## What changes

- **ADDED** `src/app/bills/[id]/page.tsx` — dynamic route, Server Component that fetches the bill and renders the detail layout.
- **ADDED** `src/features/bills/components/bill-detail-view.tsx` — the two-column detail layout (PDF on left, fields + actions + timeline on right). Client component because actions trigger mutations.
- **ADDED** `src/features/bills/components/bill-pdf-viewer.tsx` — iframe pointing at `/public/samples/<filename>.pdf`; graceful fallback when `pdfPath` is null.
- **ADDED** `src/features/bills/components/bill-fields.tsx` — read-only display of vendor, amount, dates, memo, GL category, line items.
- **ADDED** `src/features/bills/components/bill-action-bar.tsx` — contextual actions based on current status and user role: Submit / Approve+Reject / Schedule / Pay.
- **ADDED** `src/features/bills/components/bill-activity-timeline.tsx` — chronological event list with actor avatar, verb, and relative timestamp.
- **ADDED** `src/features/bills/components/schedule-payment-dialog.tsx` — modal with date picker and method radio for the Schedule action.
- **ADDED** `src/features/bills/components/reject-bill-dialog.tsx` — modal with a reason textarea for the Reject action.
- **ADDED** `src/features/bills/hooks/use-bill-mutations.ts` — wraps all five lifecycle mutations with toast notifications and query invalidation.
- **ADDED** `src/hooks/use-hotkeys.ts` — minimal keyboard-shortcut hook (no dependency).
- **ADDED** shadcn primitives used here (if not already installed): `dialog`, `textarea`, `label`, `calendar`, `popover`, `sonner` (toast).

## Impact

- The full demo walkthrough works end to end.
- Users can now experience every state transition visually with timeline confirmation.
- Sets the pattern for feature components that call mutations: mutation hook + toast + query invalidation in one place.
- No schema or backend changes — pure consumption of the existing lifecycle API.

## Success criteria

- Clicking a row in the inbox opens `/bills/[id]` and renders:
  - PDF on the left (or a friendly fallback if `pdfPath` is null).
  - Bill fields, action bar, and activity timeline on the right.
- Action bar is contextual:
  - DRAFT: Submit button visible. Edit is out of scope for this change.
  - PENDING_APPROVAL: as an APPROVER, Approve + Reject buttons visible; as a SUBMITTER, an info row reading "Waiting on approver" (no action buttons).
  - APPROVED: Schedule payment button visible.
  - SCHEDULED: Send Payment button visible; shows scheduled date + method as context.
  - PAID: no actions; shows confirmation number.
  - REJECTED: no actions; shows rejection reason.
- The full demo path works: start as Gus on a DRAFT bill (amount ≥ $5k), click Submit → status becomes PENDING_APPROVAL, timeline grows by one. Switch to Ada, click Approve → status becomes APPROVED, timeline grows. Switch to Gus, click Schedule, pick a date and method → status becomes SCHEDULED. Click Send Payment → status becomes PAID, confirmation number displayed, timeline shows `paid` event.
- Keyboard shortcuts work on the detail page: `A` triggers Approve (when applicable), `R` triggers Reject (opens the reject dialog).
- All mutations invalidate the relevant queries (`bill.get`, `bill.list`) so the UI updates without a manual refresh.
- Error states: invalid transitions surface a red toast. Unauthorized actions (e.g., SUBMITTER clicking Approve — shouldn't be reachable but defense in depth) surface a red toast and make no state change.
- `npm run build` passes. Vercel deploy works.
