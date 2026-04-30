# Design: add-scheduled-payment-execution

## The job is a 30-line wrapper around an existing transition

The whole feature is small because the bill service already knows how to pay a bill. The cron job's only responsibilities are:

1. Find candidate bills (`status = SCHEDULED AND scheduledPayDate <= now`).
2. For each candidate, call the existing transition.
3. Aggregate per-bill outcomes into a `JobResult`.

```ts
// src/features/payments/process-scheduled-payments.ts
import 'server-only';
import type { CronJob } from '@/server/cron/types';
import { payBill } from '@/features/bills/bill-service';
import { SYSTEM_USER_ID } from '@/features/users/system-user';

export const processScheduledPayments: CronJob = {
  name: 'process-scheduled-payments',
  description: 'Transitions every SCHEDULED bill whose pay date has arrived to PAID.',
  async run(ctx) {
    const due = await ctx.db.bill.findMany({
      where: { status: 'SCHEDULED', scheduledPayDate: { lte: ctx.now } },
      select: { id: true },
    });

    let processed = 0;
    const errors: Array<{ id?: string; message: string }> = [];

    for (const bill of due) {
      try {
        await payBill(bill.id, SYSTEM_USER_ID);
        processed++;
      } catch (err) {
        errors.push({
          id: bill.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      jobName: 'process-scheduled-payments',
      processed,
      skipped: 0,
      errors,
    };
  },
};
```

Then a single line in `src/server/cron/registry.ts`:

```ts
import { processScheduledPayments } from '@/features/payments/process-scheduled-payments';
export const cronRegistry: CronJob[] = [processScheduledPayments];
```

That's the entire feature. The `add-cron-infrastructure` change pre-built every other piece: auth, dispatch, error handling, admin UI.

## Per-bill transactions, not one giant transaction

The job uses one Prisma transaction *per bill* — by calling the public `payBill`, which already opens its own transaction internally. This is deliberate.

A single batch transaction would have one nice property (atomic "today's payments") but two bad ones:

1. **One bad row blocks all of them.** If bill #5 hits a constraint error, bills 1-4 roll back too. That violates the JobResult contract, where the `errors` array is meant to coexist with non-zero `processed`.
2. **Long transactions hold a connection.** Neon's pooled connection is fine for short, single-row writes. A transaction wrapping fifty `payBill` calls holds the connection for tens to hundreds of milliseconds and can starve other requests.

Per-bill transactions are the right boundary: each transition is its own atomic unit (consistent with the existing bills domain rule), and a failure in one bill is independent of the others.

## Why extract `payBillInner`?

The existing `payBill` is `db.$transaction(async (tx) => { /* logic */ })`. The cron loop calls `payBill` directly per bill, which means each call opens a fresh transaction. This works.

We still extract `payBillInner(tx, billId, actorId)` for one reason: **symmetry with the established pattern**. The bills service already exposes `submitBillInner` and `createBillInner` for `createAndSubmitBill` to compose them in a single transaction. Adding `payBillInner` keeps the shape uniform, and gives a future `createAndPayBill` (or batch payment composition) a single composable primitive.

The refactor is mechanical:

```ts
// Before
export async function payBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction(async (tx) => {
    /* 20 lines of logic */
  });
}

// After
async function payBillInner(tx: Tx, billId: string, actorId: string): Promise<Bill> {
  /* same 20 lines */
}

export async function payBill(billId: string, actorId: string): Promise<Bill> {
  return db.$transaction((tx) => payBillInner(tx, billId, actorId));
}
```

Existing callers (the tRPC `bill.pay` mutation, the "Send payment" button) see no behavioral change.

The cron loop continues to call the public `payBill` — not `payBillInner` — because per-bill isolation is the right transaction boundary. `payBillInner` exists for future composition, not for the cron itself.

## The System user

The cron writes `BillEvent` rows. Every `BillEvent` has an `actorId`. The cron is not a human, so we need a stable user record to attribute its writes to.

Two reasonable choices:

- **(a) Reuse the bill's `createdById` as the actor.** Misleading: the audit log would show "Gus paid this bill" when really the system did.
- **(b) Seed a dedicated System user.** Clear audit trail. Costs one row in the user table.

Going with (b). The seed creates one extra row:

```ts
const systemUser = await db.user.upsert({
  where: { id: SYSTEM_USER_ID },
  update: {},
  create: {
    id: SYSTEM_USER_ID,
    name: 'System',
    email: 'system@settle.local',
    role: 'SUBMITTER',
  },
});
```

`SYSTEM_USER_ID` is a stable string constant exported from `src/features/users/system-user.ts`. Using a known constant (not a generated `cuid`) is intentional: code paths that reference the System user by id should be greppable, and re-seeding should never produce a new id.

Role choice is `SUBMITTER`. The cron only calls `payBill`, which doesn't role-check (only `approveBill` and `rejectBill` do). `SUBMITTER` is the safer default — if something later mistakenly invokes `approveBill` with the System user, the `UnauthorizedError` correctly fires. Extending `UserRole` with a `SYSTEM` enum value would be overkill for the MVP and would force exhaustiveness updates across the codebase.

The `users.list` tRPC query already returns all users alphabetically. The System user will appear in any UI that lists users (e.g., the user switcher). That's acceptable for the demo — a user named "System" in the switcher is self-describing. If it becomes a UX problem, a `User.hidden: boolean` flag is the obvious next step, but it's not needed for this change.

The existing `users` spec scenario "exactly one user with role = SUBMITTER" needs to be relaxed to "at least one." The requirement text already says "at least one" — only the scenario was over-tight.

## Idempotency

Idempotency is achieved by the status filter. `WHERE status = 'SCHEDULED'` excludes already-paid bills, so a second run finds nothing.

The narrower contract: between two consecutive runs, no `SCHEDULED` bill is created with a `scheduledPayDate <= now` that wasn't there before. This holds because:

- The "Send payment" button is the only other way to leave `SCHEDULED`, and it transitions *out* of the eligible set.
- Schedule mutations that create new `SCHEDULED` bills with past dates are unusual but not impossible (a user could schedule for today). The cron will pick them up on the next tick. No double-pay risk because once paid, status is `PAID` forever.

If a future change adds back-dated scheduling that races with the cron, the per-bill transaction in `payBill` is the safety net: the second concurrent transition fails the source-status check and throws `InvalidTransitionError`. The cron records that as an error and moves on.

## Why not a polling-based UI

Out of scope, deliberately. The dashboard reflects the new state on next navigation. Real AP products refresh on navigation, not on push. Users who want "did the cron run yet?" feedback open `/admin/cron` and click "Run now." Adding WebSockets or SSE for a once-a-day batch would be over-engineered for a demo.

## What this change does NOT do

- **No new tRPC mutation.** Manual triggering uses the admin page's existing server action from `add-cron-infrastructure`.
- **No payment rail integration.** Confirmation strings remain `SETTLE-<unix-millis>-<6-char-random>`, identical to manual payment.
- **No batched transaction.** Per-bill, by design.
- **No date-window filtering beyond `<= now`.** The job has no concept of "today only" or "this week's payments." If a bill was scheduled for last week and somehow missed (the cron didn't run), the next tick processes it.
- **No notifications, no emails, no live UI.** Future domains.
- **No vendor-specific logic.** The job doesn't read `Vendor.paymentMethod` to choose ACH vs CHECK. The bill's `scheduledMethod` was already chosen at scheduling time and is preserved as-is.
