# Tasks: add-bill-lifecycle

## Dependencies

- [x] Install `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@trpc/next`, `@tanstack/react-query`, `superjson`, `zod` (if not already present).

## tRPC bootstrap

- [x] Create `src/server/trpc.ts`:
  - Starts with `import 'server-only';`
  - Exports `createContext({ req })` that reads `settle-user-id` cookie, falls back to a constant `DEFAULT_USER_ID` (resolve to the seeded SUBMITTER at startup), loads the user from `db`, returns `{ db, user }`.
  - Initializes `initTRPC.context<Context>().create({ transformer: superjson })`.
  - Exports `router`, `publicProcedure`, `protectedProcedure`.
- [x] Create `src/server/root-router.ts`:
  - `import 'server-only';`
  - Composes domain routers: `billRouter`, `vendorRouter?` (skip for this change), etc.
  - Exports `appRouter` and `type AppRouter = typeof appRouter`.
- [x] Create Next.js route handler at `src/app/api/trpc/[trpc]/route.ts`:
  - Uses `fetchRequestHandler` from `@trpc/server/adapters/fetch`.
  - Exports `GET` and `POST` bound to `appRouter` with `createContext`.

## Approval rules

- [x] Create `src/features/approvals/approval-rules.ts`:
  - Exports `APPROVAL_THRESHOLD_CENTS = 500_000`.
  - Exports `requiresApproval(amountCents: number): boolean`.
  - No other logic in this change; future rules live here.

## Bills — schemas

- [x] Create `src/features/bills/schemas.ts`:
  - Exports zod schemas for each mutation input:
    - `CreateBillInput` (vendorId, amountCents, issueDate, dueDate, memo?, glCategory?, lineItems, invoiceNumber?)
    - `UpdateBillInput` (id + partial of Create)
    - `RejectInput` (billId, reason: string)
    - `ScheduleInput` (billId, payDate: Date, method: PaymentMethod)
    - `ListBillsInput` (status?, dueBefore?, needsMyApproval?, search?)
  - Each schema uses kebab-named exports; no `export default`.

## Bills — errors

- [x] Create `src/features/bills/errors.ts`:
  - Exports `InvalidTransitionError` class (carries `fromStatus`, `toStatus`).
  - Exports `UnauthorizedError` class (carries `action: string`).
  - Exports a type guard `isBillServiceError(e): e is InvalidTransitionError | UnauthorizedError`.

## Bills — service (the state machine)

- [x] Create `src/features/bills/bill-service.ts`:
  - `import 'server-only';`
  - All functions wrap logic in `db.$transaction(async (tx) => { ... })`.
  - Every state-changing function appends a `BillEvent` in the same transaction.
- [x] Implement `createBill(input: CreateBillInput, actorId: string): Promise<Bill>`:
  - Inserts Bill with status DRAFT, line items, and a `created` BillEvent.
- [x] Implement `updateBill(input: UpdateBillInput, actorId: string): Promise<Bill>`:
  - Allowed only when `status === DRAFT`. Throws `InvalidTransitionError` otherwise.
  - Appends `edited` BillEvent with a payload of changed fields.
- [x] Implement `submitBill(billId: string, actorId: string): Promise<Bill>`:
  - Source must be DRAFT. Throws `InvalidTransitionError` otherwise.
  - If `amountCents >= APPROVAL_THRESHOLD_CENTS`: sets `status = PENDING_APPROVAL`, stamps `submittedAt`, writes `submitted` event.
  - Else: sets `status = APPROVED`, stamps `submittedAt`, `approvedAt`, `approvedById = actorId`. Writes BOTH `submitted` and `approved` events in the same transaction.
- [x] Implement `approveBill(billId: string, actorId: string): Promise<Bill>`:
  - Loads actor. If `actor.role !== 'APPROVER'`, throws `UnauthorizedError`.
  - Source must be PENDING_APPROVAL. Throws `InvalidTransitionError` otherwise.
  - Sets `status = APPROVED`, stamps `approvedAt`, `approvedById`. Writes `approved` event.
- [x] Implement `rejectBill(billId: string, actorId: string, reason: string): Promise<Bill>`:
  - Loads actor. If `actor.role !== 'APPROVER'`, throws `UnauthorizedError`.
  - Source must be PENDING_APPROVAL. Throws `InvalidTransitionError` otherwise.
  - Sets `status = REJECTED`, stamps `rejectedAt`, `rejectedReason`. Writes `rejected` event with `reason` in payload.
- [x] Implement `scheduleBill(billId: string, actorId: string, payDate: Date, method: PaymentMethod): Promise<Bill>`:
  - Source must be APPROVED. Throws `InvalidTransitionError` otherwise.
  - Sets `status = SCHEDULED`, stamps `scheduledPayDate`, `scheduledMethod`. Writes `scheduled` event.
- [x] Implement `payBill(billId: string, actorId: string): Promise<Bill>`:
  - Source must be SCHEDULED. Throws `InvalidTransitionError` otherwise.
  - Generates `paymentConfirmation = SETTLE-${Date.now()}-${6-char-random}`.
  - Sets `status = PAID`, stamps `paidAt`. Writes `paid` event with confirmation in payload.
- [x] Implement `listBills(input: ListBillsInput, actorId: string)`:
  - Applies status, dueBefore, search filters.
  - If `needsMyApproval === true`: adds `status = PENDING_APPROVAL`. If actor is not APPROVER, returns empty array without error.
  - Returns bills with vendor included; ordered by `dueDate` ascending.
- [x] Implement `getBill(billId: string)`:
  - Returns bill with `vendor`, `lineItems`, `events` (ordered `createdAt` asc) included.

## Bills — router

- [x] Create `src/features/bills/bill-router.ts`:
  - `import 'server-only';`
  - Exposes: `list`, `get`, `create`, `update`, `submit`, `approve`, `reject`, `schedule`, `pay`.
  - Each mutation wraps the service and catches errors:
    - `InvalidTransitionError` → `TRPCError({ code: 'BAD_REQUEST', ... })`
    - `UnauthorizedError` → `TRPCError({ code: 'FORBIDDEN', ... })`
    - Other → rethrow.
  - Passes `ctx.user.id` as the actor to every service call.
- [x] Register `billRouter` under `bills` in `src/server/root-router.ts`.

## Verification

Verification is done via a temporary Node script at `scripts/verify-lifecycle.ts` (gitignored, not part of the product). It uses the tRPC client to exercise the full state machine against the live DB. The alternative — manual REST calls — is error-prone for this.

- [x] Create `scripts/verify-lifecycle.ts` that calls, in sequence:
  1. List all bills with status PENDING_APPROVAL — confirms LW-2024-INV-889 is present.
  2. As a SUBMITTER, attempt `approve` on LW-2024-INV-889 — expects FORBIDDEN.
  3. As APPROVER (Ada), `approve` LW-2024-INV-889 — expects success, status → APPROVED.
  4. Again as APPROVER, `approve` the same bill — expects BAD_REQUEST (invalid transition).
  5. As SUBMITTER (Gus), `schedule` the bill for tomorrow, method ACH — expects success, status → SCHEDULED.
  6. `pay` the bill — expects success, status → PAID, confirmation string populated.
  7. Inspect events for that bill — expects a chronological sequence ending in `paid`.
- [x] Run the verify script. All seven steps pass.
- [x] Re-seed the DB (`npm run db:seed`) to reset state for subsequent changes. Confirm the seed still runs idempotently.
- [x] `npm run build` passes without TypeScript errors.
- [x] `npm run dev` boots; hitting `/api/trpc/bill.list` via curl returns a valid JSON response with the seeded bills.

## Definition of done

- All checkboxes above are ticked.
- The full demo path (SUBMITTER → PENDING_APPROVAL → APPROVER approves → SUBMITTER schedules → SUBMITTER pays) works end to end via tRPC with no UI.
- Every state-changing call produces exactly one atomic Prisma transaction.
- `openspec validate --strict add-bill-lifecycle` passes.
