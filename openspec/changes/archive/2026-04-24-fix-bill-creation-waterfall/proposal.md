# Change: fix-bill-creation-waterfall

## Why

Creating a bill via intake currently issues three sequential tRPC round-trips:

1. `intake.extractFromPdf` — ~1.7s (Claude API + Blob upload)
2. `bill.create` — ~1.1s (insert into Neon)
3. `bill.submit` — ~1.1s (transition to PENDING_APPROVAL/APPROVED)

Total: ~4 seconds from "click Submit for approval" to detail-page render. The user stares at a spinner for four seconds on what should feel like a single action.

The extraction step can't be avoided — it has to complete before the form can even render. But steps 2 and 3 are sequential only because the client does them one at a time; the server could do both in a single mutation.

## What Changes

- **ADDED** `bill.createAndSubmit` tRPC mutation: accepts the same input as `bill.create` but, after inserting the bill, immediately calls the `submitBill` service in the same transaction. Returns the bill in its post-submit state.
- **MODIFIED** `src/features/bills/bill-service.ts` — adds `createAndSubmitBill(input, actorId)` that wraps `createBill` + `submitBill` in a single transaction, removing the round-trip.
- **MODIFIED** `src/features/intake/components/bill-intake-form.tsx` — the "Submit for approval" button calls `bill.createAndSubmit` instead of chained `create` then `submit`. The "Save as draft" button still uses `bill.create` unchanged.

## Impact

- Bill creation via "Submit for approval" drops from ~4s to ~2.5-2.8s (the extraction step still dominates, but steps 2 and 3 collapse to one).
- Server-side atomicity is preserved — the bill exists only in a consistent post-submit state, or not at all.
- No schema change. No breaking change to existing mutations (`create` and `submit` still exist for their other callers).
- "Save as draft" flow unchanged.

## Success criteria

- Submitting a bill via the intake form issues exactly one network request after extraction completes (the `createAndSubmit` mutation).
- Total time from Submit click to detail page navigation drops by roughly the latency of one round-trip (~1 second).
- A failed submission rolls back the bill creation — no orphan DRAFT bills left in the database when submission fails for any reason.
- The existing `bill.create` and `bill.submit` mutations continue to work unchanged for the rest of the app (save-as-draft, detail-page submit button).
- `npm run build` passes.
