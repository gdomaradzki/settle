# Tasks: add-scheduled-payment-execution

## Schema — none

This change introduces no Prisma schema changes. The bill model already has every field the cron needs (`status`, `scheduledPayDate`, `paidAt`, `paymentConfirmation`).

## Service — extract `payBillInner`

- [ ] In `src/features/bills/bill-service.ts`, extract a private `payBillInner(tx: Tx, billId: string, actorId: string): Promise<Bill>` helper containing the body of the existing `payBill` (source-status check, confirmation generation, bill update, `paid` BillEvent).
- [ ] Refactor the public `payBill` to be a thin wrapper that calls `db.$transaction((tx) => payBillInner(tx, billId, actorId))`. No behavioral change visible to callers.
- [ ] Verify no other call site changes are required (tRPC `bill.pay`, "Send payment" button still call the public `payBill`).

## Service — System user

- [ ] Create `src/features/users/system-user.ts`:
  - `import 'server-only';`
  - Exports `SYSTEM_USER_ID = "system"` (or another stable constant string — must be greppable, not a `cuid`).
  - Exports an async helper `getOrCreateSystemUser()` if the implementer prefers runtime initialization; otherwise rely on the seed (preferred for the MVP demo).
- [ ] In `prisma/seed.ts`, add an `upsert` for the System user immediately after the existing user seed block:
  - `id: SYSTEM_USER_ID`, `name: "System"`, `email: "system@settle.local"`, `role: SUBMITTER`.
  - Idempotent: subsequent `npm run db:seed` runs SHALL NOT throw or create duplicates.
- [ ] Confirm the existing `users.list` tRPC query returns the System user along with Gus and Ada (no code change required; the assertion is for verification).

## Service — the cron job

- [ ] Create `src/features/payments/process-scheduled-payments.ts`:
  - `import 'server-only';`
  - Exports `processScheduledPayments: CronJob` (named export, not default).
  - `run(ctx)`:
    - Queries `ctx.db.bill.findMany({ where: { status: "SCHEDULED", scheduledPayDate: { lte: ctx.now } }, select: { id: true } })`.
    - Iterates results; for each, calls `payBill(bill.id, SYSTEM_USER_ID)` inside a try/catch.
    - On success: increments `processed`.
    - On error: appends `{ id: bill.id, message: <error.message> }` to `errors`.
    - Returns `{ jobName: "process-scheduled-payments", processed, skipped: 0, errors }`.
  - Does NOT open its own transaction; relies on `payBill`'s internal transaction per bill.

## Registry — register the job

- [ ] In `src/server/cron/registry.ts`, append `processScheduledPayments` to the `cronRegistry` array. Import path: `@/features/payments/process-scheduled-payments`.
- [ ] Confirm the file's diff is exactly two lines: one `import` and one array entry. The registry's structure SHALL NOT change.

## UI — none required

The admin page (`/admin/cron`) and the bill detail timeline already render this job and the resulting events. No UI code changes.

## Verification

- [ ] `npm run db:seed` — confirms the System user is created without errors and is idempotent.
- [ ] `npm run build` passes clean.
- [ ] Manual demo flow:
  1. Schedule any APPROVED bill for today via the existing UI.
  2. Visit `/admin/cron` — `process-scheduled-payments` is listed.
  3. Click "Run now" — page refreshes; the JobResult shows `processed: 1`.
  4. Open the just-paid bill's detail page — status is `PAID`, the timeline ends with a `paid` event whose actor is "System", and the confirmation string matches `/^SETTLE-\d+-[A-Z0-9]{6}$/`.
- [ ] Idempotency check: click "Run now" a second time without scheduling another bill. The JobResult shows `processed: 0`.
- [ ] Date filter check: schedule a bill for *tomorrow*. Click "Run now" today. The bill's status remains `SCHEDULED` (not picked up).
- [ ] Manual payment still works: schedule a bill, then click "Send payment" on the bill detail page. The bill transitions to PAID via the existing manual flow with the human actor (not the System user).
- [ ] `openspec validate --strict add-scheduled-payment-execution` passes.

## Definition of done

- All checkboxes above are ticked.
- `payBillInner` exists alongside `submitBillInner` and `createBillInner` in `bill-service.ts`. The public `payBill` is a one-line wrapper.
- The System user exists in the database and is the actor on every `paid` BillEvent written by the cron.
- The cron registry has exactly one entry: `processScheduledPayments`. (If `add-recurring-bills` has merged in parallel, then it has two entries. Either is acceptable — the order between them is not load-bearing.)
- No changes outside `src/features/bills/`, `src/features/payments/`, `src/features/users/`, `src/server/cron/registry.ts`, and `prisma/seed.ts`.
