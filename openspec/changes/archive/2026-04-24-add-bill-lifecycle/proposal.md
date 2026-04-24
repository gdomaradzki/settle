# Change: add-bill-lifecycle

## Why

The schema exists but nothing can move a bill through its lifecycle. Every downstream UI change — inbox, detail, dashboard, intake — calls into bill lifecycle mutations. Without this change, the product has data but no behavior.

This change implements the state machine: the five transitions that move a bill from DRAFT to PAID, or sideways to REJECTED. It's backend-only — no pages, no components. The goal is a service and tRPC surface that's demo-ready via direct API calls, verifiable before any UI is built on top.

## What changes

- **ADDED** `bills` domain: state machine functions in `src/features/bills/bill-service.ts` covering `submit`, `approve`, `reject`, `schedule`, `pay`. Each validates source status, stamps destination fields, and appends a `BillEvent` in a single Prisma transaction.
- **ADDED** `bills` domain: tRPC mutations in `src/features/bills/bill-router.ts` wrapping the service.
- **ADDED** `bills` domain: zod input schemas in `src/features/bills/schemas.ts`.
- **ADDED** `approvals` domain: the threshold constant `APPROVAL_THRESHOLD_CENTS = 500_000` and helper `requiresApproval(amountCents)` in `src/features/approvals/approval-rules.ts`.
- **ADDED** tRPC bootstrap: `src/server/trpc.ts` (context + procedure factories) and `src/server/root-router.ts` (composes feature routers).
- **ADDED** Next.js route handler at `src/app/api/trpc/[trpc]/route.ts` to expose the tRPC API over HTTP.
- **ADDED** a fake session mechanism: a cookie-backed `currentUserId` read by the tRPC context. No UI for switching yet — that lands in `add-app-shell`. For now, a default session resolves to the seeded SUBMITTER if no cookie is set.

## Impact

- Unblocks `add-app-shell`, `add-bill-inbox`, `add-bill-detail`, `add-bill-intake`, `add-dashboard`, and the AP aging report. Everything downstream depends on these mutations existing.
- No user-visible change yet — this is backend truth without a UI on top. Verification happens via direct tRPC calls from a Node script or Prisma Studio inspection.
- Establishes the pattern every future domain will follow: service → router → schema, co-located under `src/features/[domain]/`.

## Success criteria

- Invoking `submit` on a DRAFT bill below the threshold transitions it straight to APPROVED and writes both `submitted` and `approved` BillEvents in one transaction.
- Invoking `submit` on a DRAFT bill at or above `APPROVAL_THRESHOLD_CENTS` transitions it to PENDING_APPROVAL and writes a `submitted` event.
- Invoking `approve` from a non-APPROVER user raises an authorization error and makes no state change.
- Invoking `approve` on a bill not in PENDING_APPROVAL raises an invalid-transition error and makes no state change.
- Invoking `pay` on a SCHEDULED bill stamps `paidAt`, `paymentConfirmation`, and writes a `paid` BillEvent.
- All mutations are atomic: if the BillEvent insert fails for any reason, the Bill update is rolled back.
- `npm run build` passes clean. `npm run dev` boots without runtime errors.
- The `seed` bill LW-2024-INV-889 (the $12,500 PENDING_APPROVAL seeded bill) can be walked through approve → schedule → pay end-to-end via direct tRPC calls.
