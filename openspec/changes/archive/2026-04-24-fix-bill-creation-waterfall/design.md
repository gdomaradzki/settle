# Design: fix-bill-creation-waterfall

## Why not just call both mutations from one promise chain

An earlier instinct is to keep both mutations and call them in quick succession:

```ts
const bill = await createMutation.mutateAsync(input);
await submitMutation.mutateAsync(bill.id);
```

This looks simpler but doesn't fix the problem — it's still two HTTP round-trips. The two requests are serialized (submit needs the bill's id), so latency adds.

## Combining on the server

The service-level helper:

```ts
// src/features/bills/bill-service.ts
export async function createAndSubmitBill(
  input: CreateBillInput,
  actorId: string,
): Promise<Bill> {
  return db.$transaction(async (tx) => {
    // 1. Create the bill (same logic as createBill, but against tx)
    const bill = await tx.bill.create({
      data: {
        // ... same fields as createBill ...
        status: "DRAFT",
      },
      include: {
        /* same as createBill's return */
      },
    });

    await tx.billEvent.create({
      data: { billId: bill.id, type: "created", actorId, payload: {} },
    });

    // 2. Immediately run the submit transition against the same tx
    // Duplicating the submit logic here (rather than calling submitBill)
    // because submitBill opens its own $transaction which would nest badly.
    const wouldAutoApprove = bill.amountCents < APPROVAL_THRESHOLD_CENTS;
    const nextStatus = wouldAutoApprove ? "APPROVED" : "PENDING_APPROVAL";

    const updated = await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: nextStatus,
        submittedAt: new Date(),
        ...(wouldAutoApprove && {
          approvedAt: new Date(),
          approvedById: actorId,
        }),
      },
      include: {
        /* ... */
      },
    });

    await tx.billEvent.create({
      data: {
        billId: bill.id,
        type: "submitted",
        actorId,
        payload: { fromStatus: "DRAFT", toStatus: nextStatus },
      },
    });

    if (wouldAutoApprove) {
      await tx.billEvent.create({
        data: {
          billId: bill.id,
          type: "approved",
          actorId,
          payload: { fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED" },
        },
      });
    }

    return updated;
  });
}
```

**The duplication is unfortunate.** The `submitBill` function already encapsulates this logic, but it opens its own `$transaction`, so calling it from within another transaction would either nest (Prisma doesn't support nested transactions by default) or require refactoring both functions to take an optional `tx` parameter.

**Better alternative: extract the inner logic.** Refactor `createBill` and `submitBill` to have "inner" variants that take a Prisma transaction client:

```ts
async function createBillInner(tx, input, actorId) {
  /* ... */
}
async function submitBillInner(tx, billId, actorId) {
  /* ... */
}

export async function createBill(input, actorId) {
  return db.$transaction((tx) => createBillInner(tx, input, actorId));
}

export async function submitBill(billId, actorId) {
  return db.$transaction((tx) => submitBillInner(tx, billId, actorId));
}

export async function createAndSubmitBill(input, actorId) {
  return db.$transaction(async (tx) => {
    const bill = await createBillInner(tx, input, actorId);
    return submitBillInner(tx, bill.id, actorId);
  });
}
```

**This is the right refactor.** One place per transition logic, reused across individual and combined mutations. Do this rather than duplicating.

## Router wiring

```ts
// src/features/bills/bill-router.ts
createAndSubmit: protectedProcedure
  .input(CreateBillInput)
  .mutation(async ({ ctx, input }) => {
    try {
      return await createAndSubmitBill(input, ctx.user.id);
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      }
      throw err;
    }
  }),
```

## Intake form update

The intake form has two buttons. Only "Submit for approval" changes:

```tsx
// Before
const createMutation = trpc.bill.create.useMutation();
const submitMutation = trpc.bill.submit.useMutation();

const onSubmitForApproval = async (data) => {
  const bill = await createMutation.mutateAsync(data);
  await submitMutation.mutateAsync(bill.id);
  router.push(`/bills/${bill.id}`);
};

// After
const createAndSubmitMutation = trpc.bill.createAndSubmit.useMutation();

const onSubmitForApproval = async (data) => {
  const bill = await createAndSubmitMutation.mutateAsync(data);
  router.push(`/bills/${bill.id}`);
};
```

"Save as draft" keeps using `trpc.bill.create` — that flow has no submit step to combine.

## What this change does not do

- **Does not speed up extraction.** That's dominated by Claude's API latency (~1.5-2s) and can only be improved by switching models (lower quality) or caching (doesn't apply per-PDF).
- **Does not speed up the post-submit navigation.** The final refetch after navigation is a separate round-trip; collapsing it would require SSR-hydrating the detail page with data from the mutation response, which is a bigger refactor.
- **Does not apply to other waterfalls** — detail-page actions (approve → refetch, pay → refetch) already invalidate on settle, which is the right pattern. This change only targets the intake waterfall.
