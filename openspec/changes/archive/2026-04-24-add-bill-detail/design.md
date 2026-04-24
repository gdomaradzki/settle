# Design: add-bill-detail

## Page architecture

`src/app/bills/[id]/page.tsx` is a Server Component that:

1. Reads `params.id` from the route.
2. Fetches the bill via the server-side tRPC caller (`appRouter.createCaller(ctx)`), NOT by calling the HTTP endpoint.
3. Renders `notFound()` if the bill doesn't exist.
4. Passes the bill to `<BillDetailView bill={bill} />` as initial props.

The detail view is a Client Component because every action triggers a mutation. The initial data arrives as props (no loading flash on first render), then subsequent refetches happen through `trpc.bill.get.useQuery({ id }, { initialData: bill })`.

Why server-side initial fetch instead of pure client-side:

- No loading flicker on the hero detail page.
- SEO-friendly (the page renders with bill data on first response).
- `notFound()` works correctly — client-side would have to handle the "doesn't exist" state with a dedicated UI branch.

## Two-column layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TopBar                                                          │
├─────────────────────────────────────────────────────────────────┤
│  ← Back to bills                  [Status pill] Invoice IN-001  │
├──────────────────────────────┬──────────────────────────────────┤
│                              │  Vendor:     Latham & Watkins    │
│                              │  Amount:     $12,500.00          │
│                              │  Issued:     Apr 10, 2026        │
│       [PDF viewer]           │  Due:        Apr 27, 2026        │
│                              │  Method:     ACH                 │
│       iframe                 │  GL:         Legal               │
│                              │                                   │
│                              │  Memo: Q2 retainer                │
│                              │  ─────────────                    │
│                              │  Line items (1)                   │
│                              │  · Q2 retainer fee   $12,500.00  │
│                              │  ─────────────                    │
│                              │  [Action bar]                    │
│                              │  ─────────────                    │
│                              │  Activity                         │
│                              │  • Gus created   2d ago          │
│                              │  • Gus submitted  2d ago         │
│                              │  ...                              │
└──────────────────────────────┴──────────────────────────────────┘
```

Split point: ~55% left (PDF), ~45% right (content). On mobile, stack: PDF first, content below.

## Action bar — contextual UX

A single `<BillActionBar>` component branches on `(bill.status, currentUser.role)`:

| Status           | Role      | Renders                                                                        |
| ---------------- | --------- | ------------------------------------------------------------------------------ |
| DRAFT            | any       | **Submit bill** primary button                                                 |
| PENDING_APPROVAL | APPROVER  | **Approve** (primary) + **Reject** (secondary)                                 |
| PENDING_APPROVAL | SUBMITTER | Info row: "Waiting on approver"                                                |
| APPROVED         | any       | **Schedule payment** primary button                                            |
| SCHEDULED        | any       | **Send payment** primary button, secondary row showing scheduled date + method |
| PAID             | any       | Success block with confirmation number                                         |
| REJECTED         | any       | Muted block showing rejection reason                                           |

The SUBMITTER seeing "Waiting on approver" on PENDING_APPROVAL bills is the right UX — it explains why they can't act, avoids a hidden/empty bar, and reads naturally.

## Mutation flow

All five mutations share the same shape:

```ts
const approve = trpc.bill.approve.useMutation({
  onSuccess: () => {
    utils.bill.get.invalidate({ id });
    utils.bill.list.invalidate();
    toast.success("Bill approved");
  },
  onError: (err) => toast.error(err.message),
});
```

Co-located in `src/features/bills/hooks/use-bill-mutations.ts` to avoid repeating the boilerplate across four components:

```ts
export function useBillMutations(billId: string) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.bill.get.invalidate({ id: billId });
    utils.bill.list.invalidate();
  };
  return {
    submit: trpc.bill.submit.useMutation({
      onSuccess: () => {
        invalidate();
        toast.success("Bill submitted");
      },
      onError: toastError,
    }),
    approve: trpc.bill.approve.useMutation({
      onSuccess: () => {
        invalidate();
        toast.success("Bill approved");
      },
      onError: toastError,
    }),
    reject: trpc.bill.reject.useMutation({
      onSuccess: () => {
        invalidate();
        toast.success("Bill rejected");
      },
      onError: toastError,
    }),
    schedule: trpc.bill.schedule.useMutation({
      onSuccess: () => {
        invalidate();
        toast.success("Payment scheduled");
      },
      onError: toastError,
    }),
    pay: trpc.bill.pay.useMutation({
      onSuccess: () => {
        invalidate();
        toast.success("Payment sent");
      },
      onError: toastError,
    }),
  };
}
```

## Dialogs for Schedule and Reject

Both need additional input beyond a click:

**`<SchedulePaymentDialog>`** — opens when user clicks "Schedule payment." Fields:

- Pay date: date picker (shadcn `Popover` + `Calendar`, defaulting to today + 2 business days).
- Method: radio group (ACH / Check), defaulting to the vendor's preferred method.
- Confirm / Cancel buttons.

On confirm: calls `mutations.schedule.mutate({ billId, payDate, method })`. Dialog closes on success.

**`<RejectBillDialog>`** — opens when APPROVER clicks "Reject." Fields:

- Reason: multi-line textarea, required, min 3 characters.
- Red "Reject bill" button + Cancel.

On confirm: calls `mutations.reject.mutate({ billId, reason })`. Dialog closes on success.

Rejection reason being required is a deliberate UX choice — matches how real AP tools work, gives the submitter information to act on, and prevents accidental clicks.

## Activity timeline

Reads `bill.events` (already loaded with the bill via the `bill.get` query). Renders chronologically, oldest first, as a vertical list with a left rail:

```
●──  Gus Silva created    •  2 days ago
│
●──  Gus Silva submitted  •  2 days ago
│
●──  Ada Chen approved    •  1 day ago
│
●──  Gus Silva scheduled  •  5 minutes ago
│      ACH, April 26
│
●──  Gus Silva paid       •  just now
       SETTLE-1745875200-A3K9M2
```

Each event:

- Small avatar or initials badge with the actor's name.
- Verb phrasing humanized from `event.type` ("created", "submitted", "approved", "rejected", "scheduled", "paid").
- Relative time ("just now", "5 min ago", "2 days ago") — use `formatRelativeTime(createdAt)` in `src/lib/dates.ts`.
- Secondary line for payload detail: rejection reason for `rejected`, method + date for `scheduled`, confirmation for `paid`.

Actor name comes from `actorId` — the timeline component calls `trpc.user.list.useQuery()` once to build an id-to-name map, cached by React Query.

## PDF viewer

```tsx
<iframe
  src={pdfPath ?? undefined}
  className="h-full w-full border-0 rounded-md"
  title={`Invoice ${invoiceNumber ?? id}`}
/>
```

Simple iframe — browsers render PDFs natively. `<object>` would also work but has worse fullscreen behavior and more rendering quirks across browsers.

Fallback when `pdfPath` is null: a muted block with a document icon and "No PDF attached." No scary error, just a state.

This change doesn't handle PDF uploads — that's `add-bill-intake`'s job. The detail page just consumes `bill.pdfPath`, which the seed script already populated with paths under `/public/samples/`.

## Keyboard shortcuts

A tiny custom hook:

```ts
// src/hooks/use-hotkeys.ts
export function useHotkeys(map: Record<string, () => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const fn = map[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, enabled]);
}
```

On the detail page, the action bar registers:

```ts
useHotkeys(
  {
    a: () => approveIfAllowed(),
    r: () => openRejectDialog(),
  },
  bill.status === "PENDING_APPROVAL" && user.role === "APPROVER",
);
```

Only registered when the user could actually act. No shortcut without visible action — that's a trap.

Shortcut hint displayed as a kbd badge on the buttons themselves: `Approve [A]`. Signals the capability exists without a separate help panel.

## Error handling

Service-level errors (`InvalidTransitionError`, `UnauthorizedError`) come through the mutation's `onError` callback, get formatted by the router into a TRPCError message, and are shown as a red `toast.error()`.

No inline error displays — toasts are sufficient for action errors and less visually intrusive than inline banners that persist.

## Query invalidation strategy

Every mutation invalidates:

- `trpc.bill.get({ id })` — the detail page's source of truth.
- `trpc.bill.list()` — the inbox, in case the user navigates back.

This is one network round-trip per mutation (refetch on the detail page only; inbox refetches lazily when navigated to). Acceptable overhead for MVP clarity.

Not invalidating optimistically. Optimistic updates are tempting for state transitions (they make the UI feel instant), but the state machine has real validation rules that can reject a transition — and rolling back an optimistic UI is more complex than this MVP deserves. Loading spinner + refetch is honest and simple.

## What this change does not do

- No bill editing. Only DRAFT bills can be edited per the schema, but the edit UI lives in `add-bill-intake` (alongside the create flow).
- No DRAFT delete. A DRAFT bill can live forever in the inbox; cleanup is out of scope.
- No PDF replacement. Uploaded once at intake, displayed here.
- No line item inline editing. Line items show as read-only rows even for DRAFTs in this change.
- No comments or discussion. Real AP tools have per-bill comment threads; not shipping that.
- No re-open of rejected bills. Terminal status, per the state machine spec.
- No cross-bill navigation (prev/next). One bill at a time.
