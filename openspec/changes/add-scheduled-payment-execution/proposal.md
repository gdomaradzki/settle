# Change: add-scheduled-payment-execution

## Why

Today a bill in `SCHEDULED` status sits there until a human clicks "Send payment." That's the right shape when payment is a manual decision — but if the user has already scheduled a bill for a specific date, leaving it in `SCHEDULED` until they remember to come back is just a missing automation. Real AP products execute the payment on the scheduled date.

This change closes that loop. On every daily cron tick, every bill whose `status = SCHEDULED` and `scheduledPayDate <= today` is automatically transitioned to `PAID` through the existing bill service. The manual "Send payment" button stays — users can still pay early — but the default flow no longer requires a second click after scheduling.

## What changes

- **ADDED** `payments` domain: a registered cron job named `process-scheduled-payments` whose `run()` finds all `SCHEDULED` bills with `scheduledPayDate <= ctx.now` and transitions each to `PAID` via the bill service. Lives at `src/features/payments/process-scheduled-payments.ts`. Registers itself by appending to `cronRegistry`.
- **MODIFIED** `bills` domain: extract `payBillInner(tx, billId, actorId)` from the existing `payBill` so the cron loop can reuse the exact same transition logic (confirmation generation, `BillEvent` insert, timestamp stamping). The public `payBill` becomes a thin wrapper that opens its own transaction and calls `payBillInner`. This mirrors the existing `submitBill` / `submitBillInner` split.
- **MODIFIED** `users` domain: seed a designated `System` user (name "System", email `system@settle.local`, role `SUBMITTER`). The cron job uses this user's id as the `actorId` for every `BillEvent` it writes, so the audit log can distinguish system-driven payments from human-driven ones.
- **ADDED** a sub-router `payments.runProcessScheduledPaymentsNow` on the cron tRPC surface? — no, manual triggering already runs through the admin page's server action that calls `runJob("process-scheduled-payments")`. No new tRPC routes.

## Impact

- Closes the loop for the most common AP demo flow: schedule a bill for today → walk to `/admin/cron` → click "Run now" on `process-scheduled-payments` → see the bill transition to `PAID` on the next page load.
- The audit log gains a clear distinction between human and system actors. Every `paid` event written by this cron has `actor.name = "System"`.
- No existing manual flow changes. The "Send payment" button still works on any `SCHEDULED` bill regardless of date — users can still pay early.

## Success criteria

- After registering the job, `GET /admin/cron` lists `process-scheduled-payments` with its description.
- A bill scheduled for today (or any past date) transitions from `SCHEDULED` to `PAID` when the job runs, with a `paid` `BillEvent` whose `actorId` is the System user's id and whose `payload.confirmation` matches `/^SETTLE-\d+-[A-Z0-9]{6}$/`.
- A bill scheduled for tomorrow does NOT transition when the job runs today.
- Running the job twice in a row produces a `JobResult` with `processed: 0` on the second run (already-paid bills are excluded by the status filter).
- Calling `payBill` directly (e.g., from the existing "Send payment" button) continues to work unchanged.
- `npm run build` passes clean. The bill detail timeline correctly renders the `paid` event with "System" as the actor.

## What this change does NOT do

- No payment rail integration. `payBillInner` remains a status flip + fake confirmation string, identical to today's manual `payBill`.
- No retry on failure. If a single bill's transition errors out, it's recorded in the `JobResult.errors` array; the cron does not re-attempt within the same run. The next daily tick will re-attempt because the bill is still `SCHEDULED`.
- No live UI updates. The dashboard reflects the new state on next navigation. Polling, WebSockets, or SSE are explicitly out of scope.
- No notifications. No email "your payment was sent today." That belongs to a future notifications domain.
- No support for paying ahead of schedule via cron. Bills only transition when `scheduledPayDate <= now`, never before.
