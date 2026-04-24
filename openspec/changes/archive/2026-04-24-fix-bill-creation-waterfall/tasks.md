# Tasks: fix-bill-creation-waterfall

## Refactor: extract inner transition helpers

- [x] In `src/features/bills/bill-service.ts`, extract the body of `createBill` into a private `createBillInner(tx, input, actorId)` that takes a Prisma transaction client. The public `createBill` becomes a thin wrapper that opens a `$transaction` and calls the inner.
- [x] Similarly extract `submitBillInner(tx, billId, actorId)` from `submitBill`. Public `submitBill` stays a thin transaction wrapper.
- [x] Verify tests for the individual transitions still pass (or manually retest via the existing lifecycle script).

## Add combined service function

- [x] Add `createAndSubmitBill(input, actorId)` to the bill service:
  - `import 'server-only';` (already in the file).
  - Opens a single `db.$transaction`.
  - Calls `createBillInner` to insert the DRAFT bill + `created` event.
  - Immediately calls `submitBillInner` with the newly-created bill's id.
  - Returns the final post-submit bill (APPROVED or PENDING_APPROVAL depending on the threshold).

## Add router mutation

- [x] Add `createAndSubmit` protected mutation to `src/features/bills/bill-router.ts`:
  - Input: `CreateBillInput` (the same schema as `create`).
  - Calls `createAndSubmitBill(input, ctx.user.id)`.
  - Catches `InvalidTransitionError` → `TRPCError('BAD_REQUEST')`.
  - All other errors rethrow.

## Intake form: switch to combined mutation

- [x] Update `src/features/intake/components/bill-intake-form.tsx`:
  - The "Submit for approval" button now calls `trpc.bill.createAndSubmit` instead of chained `create` then `submit`.
  - The "Save as draft" button is unchanged.
  - Loading state and navigation-on-success logic unchanged.

## Verification

- [x] `npm run build` passes.
- [x] With browser devtools Network tab open, walk the intake flow for a bill:
  - Upload a PDF. One `extractFromPdf` request completes.
  - Fill form. Click "Submit for approval."
  - In the Network tab, see exactly one `createAndSubmit` request (not a `create` followed by a `submit`).
  - Total time from click to detail-page navigation should be roughly the latency of one request, not two.
- [x] The resulting bill is in status APPROVED (under threshold) or PENDING_APPROVAL (over threshold), matching what `submit` would have produced via the two-call path.
- [x] Timeline on the new bill shows `created` + `submitted` (+ `approved` if auto-approved) — same event sequence as before.
- [x] "Save as draft" path still works unchanged: creates a DRAFT bill, does not auto-submit.
- [x] Existing uses of `bill.create` and `bill.submit` across the app (detail-page submit button, etc.) continue to work.
- [x] Deploy to Vercel. Repeat the flow on the live URL and compare the network timing.

## Definition of done

- All checkboxes above are ticked.
- Intake "Submit for approval" issues one mutation instead of two.
- No regression in existing mutation behavior.
- `openspec validate --strict fix-bill-creation-waterfall` passes.
