# Design: add-bill-lifecycle

## State machine: one service, one transaction, one event per call

All status transitions live in `src/features/bills/bill-service.ts`. Routers call into it; they never touch `Bill.status` directly. This is a hard constraint — the service is the only place where invariants (valid source status, required fields, event audit) are enforced together.

Each transition function follows the same shape:

```ts
export async function approveBill(
  billId: string,
  actorId: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    // 1. Validate source status
    if (bill.status !== "PENDING_APPROVAL") {
      throw new InvalidTransitionError(bill.status, "APPROVED");
    }

    // 2. Validate actor (role check)
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    if (actor.role !== "APPROVER") {
      throw new UnauthorizedError("approve");
    }

    // 3. Update the bill
    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: actorId,
      },
    });

    // 4. Append event
    await tx.billEvent.create({
      data: {
        billId,
        type: "approved",
        actorId,
        payload: { fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED" },
      },
    });

    return updated;
  });
}
```

The wrapping transaction is load-bearing: if the event insert fails, the bill update rolls back. The audit log and the truth never diverge. This is the most important rule in the entire service.

## The `submit` exception: conditional branching

`submitBill` has two destinations based on amount:

- `amount < APPROVAL_THRESHOLD_CENTS` → straight to `APPROVED`, writes both `submitted` and `approved` events (same transaction, same actor).
- `amount >= APPROVAL_THRESHOLD_CENTS` → to `PENDING_APPROVAL`, writes only a `submitted` event.

Under-threshold auto-approval is the product feature, not an accident. The submitter IS the approver when their own bill is under threshold — this is how Ramp actually behaves, and how finance teams set up their approval policies in practice. Below the threshold, the bill is considered "self-approved" and the `approvedById` points to the submitter.

This is also where `APPROVAL_THRESHOLD_CENTS` earns being a named constant — it's referenced in exactly one place in the service (the `submit` branch), and will be referenced again in the `add-bill-detail` UI to show a "will auto-approve" hint as the submitter types the amount.

## Rejected as terminal

`REJECTED` is a dead end. No transition function takes a REJECTED bill anywhere. The product decision is that a rejected bill stays rejected — if the submitter wants to resubmit, they create a new bill. This matches Ramp's behavior and sidesteps a nontrivial "re-open" UX that isn't worth the complexity in the MVP.

## Errors as domain objects, not strings

Two custom error classes live in `src/features/bills/errors.ts`:

```ts
export class InvalidTransitionError extends Error {
  constructor(fromStatus: BillStatus, toStatus: BillStatus) { ... }
}
export class UnauthorizedError extends Error {
  constructor(action: string) { ... }
}
```

Thrown from the service, caught and mapped to `TRPCError` codes (`BAD_REQUEST` for invalid transition, `FORBIDDEN` for unauthorized) in the router. This separation keeps the service framework-agnostic — if the tRPC layer gets swapped for REST or a job queue later, the service doesn't change.

## tRPC context and the fake session

`src/server/trpc.ts` builds the context for every tRPC call:

```ts
export async function createContext({ req }: { req: NextRequest }) {
  const userId = req.cookies.get("settle-user-id")?.value ?? DEFAULT_USER_ID;
  const user = await db.user.findUnique({ where: { id: userId } });
  return { db, user: user ?? (await getDefaultUser()) };
}
```

`DEFAULT_USER_ID` falls back to the seeded SUBMITTER (Gus) if no cookie is set. This keeps the first-ever request working without a UI switch. The actual user-switcher UI lands in `add-app-shell`; it will simply `Set-Cookie: settle-user-id=<id>`.

Two procedure factories:

- `publicProcedure` — any context, used for reads.
- `protectedProcedure` — same as public for the MVP (we have no unauthenticated user), but the seam is here for future real auth. Named so the intent reads correctly in router files.

No role-based procedure factory. Role enforcement happens **inside the service**, not at the router boundary, because some operations are role-dependent on the bill's state (e.g., a user can approve if they're an APPROVER AND the bill is PENDING_APPROVAL — two conditions the router can't cleanly check without re-fetching the bill). Keeping it in the service means one place to look.

## tRPC router shape

`src/features/bills/bill-router.ts` exposes:

```ts
export const billRouter = router({
  list:    publicProcedure.input(ListInput).query(...),
  get:     publicProcedure.input(z.string()).query(...),
  create:  protectedProcedure.input(CreateInput).mutation(...),
  update:  protectedProcedure.input(UpdateInput).mutation(...),
  submit:  protectedProcedure.input(z.string()).mutation(...),
  approve: protectedProcedure.input(z.string()).mutation(...),
  reject:  protectedProcedure.input(RejectInput).mutation(...),
  schedule: protectedProcedure.input(ScheduleInput).mutation(...),
  pay:     protectedProcedure.input(z.string()).mutation(...),
});
```

Each mutation is a thin wrapper over the service. The router's only jobs are: validate input with zod, pass `ctx.user.id` as the actor, catch service errors and map to `TRPCError` codes.

`create` and `update` are here for completeness even though the intake UI isn't built yet. Their logic is trivial (insert/update a DRAFT row) and having them in the surface keeps the router stable when intake comes online.

## `list` query shape

```ts
const ListInput = z.object({
  status: z.nativeEnum(BillStatus).optional(),
  dueBefore: z.date().optional(),
  needsMyApproval: z.boolean().optional(),
  search: z.string().optional(),
});
```

`needsMyApproval` is the interesting filter. When true, it resolves server-side to `status = PENDING_APPROVAL AND <ctx.user.role == APPROVER>`. If the current user isn't an APPROVER, it returns an empty list without error. This is deliberate UX: the dashboard tile "Needs my approval" simply reads empty for submitters, no authorization failure.

## Transaction boundaries and connection pooling

Neon's pooled connection (via `DATABASE_URL`) supports transactions via Prisma without special handling — Prisma opens a dedicated connection from the pool for the duration of `$transaction`. No changes needed from the `add-core-schema` setup.

One subtlety: `$transaction` with an async callback (interactive transactions) is used throughout this service. This is more powerful than the array form (`$transaction([op1, op2])`) because it allows conditional logic inside the transaction (read a row, branch, then write). The tradeoff is that the transaction holds a connection for the duration of the callback — acceptable here because all our transitions are fast, single-row writes.

## What this change does not do

- No UI. No pages, no components, no hooks. Those land in `add-app-shell` and the inbox/detail/intake changes that follow.
- No user switcher UI. The cookie mechanism exists and is read; writing to it is `add-app-shell`'s job.
- No payment rail integration. `payBill` simulates execution with a generated confirmation string (`SETTLE-<timestamp>-<random6>`).
- No retry or idempotency keys. A `pay` call that succeeds once and is retried would generate a second PAID event — acceptable for the MVP since the UI will disable the button after click. Real payment rails would require idempotency; called out in the README's "what I'd build next."
- No bulk operations. The CSV bulk upload change will add `createMany` separately.
