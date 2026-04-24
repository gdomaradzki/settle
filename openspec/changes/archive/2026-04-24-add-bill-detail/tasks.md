# Tasks: add-bill-detail

## Dependencies

- [x] Install shadcn primitives if not already present: `npx shadcn@latest add dialog textarea label calendar popover sonner`.
- [x] Ensure `<Toaster />` is mounted in the root layout (add to `src/components/providers.tsx` or directly in `layout.tsx` if not already present from a prior change).

## Formatting helpers

- [x] Extend `src/lib/dates.ts`:
  - Add `formatRelativeTime(date: Date): string`.
  - Returns "just now" (<60s), "X min ago", "X hours ago", "X days ago", or absolute date for >30 days.
  - Does not require a dependency like date-fns; hand-roll it.

## Mutations hook

- [x] Create `src/features/bills/hooks/use-bill-mutations.ts`:
  - Exports `useBillMutations(billId: string)`.
  - Wraps `trpc.bill.submit`, `approve`, `reject`, `schedule`, `pay` as `useMutation` calls.
  - Each mutation's `onSuccess`: invalidates `bill.get({ id })` + `bill.list`, shows a success toast with a contextual message ("Bill submitted", "Bill approved", "Payment scheduled", "Payment sent", "Bill rejected").
  - Each mutation's `onError`: shows an error toast using `err.message`.
  - Named export only.

## Hotkeys hook

- [x] Create `src/hooks/use-hotkeys.ts`:
  - Exports `useHotkeys(map: Record<string, () => void>, enabled?: boolean): void`.
  - Ignores events originating from input/textarea/contenteditable elements.
  - Adds/removes a `keydown` listener on `window`.
  - Only listens when `enabled !== false`.

## PDF viewer

- [x] Create `src/features/bills/components/bill-pdf-viewer.tsx`:
  - Props: `{ pdfPath: string | null; invoiceNumber: string | null; id: string; }`.
  - If `pdfPath` is null: renders a muted fallback block with a document-off icon and "No PDF attached."
  - Else: renders `<iframe>` pointing at `pdfPath`, title includes invoice number or bill id.
  - Full height within its column.

## Bill fields

- [x] Create `src/features/bills/components/bill-fields.tsx`:
  - Props: `{ bill: BillWithRelations }`.
  - Renders a two-column field grid (label / value):
    - Vendor (name + email if present)
    - Invoice number
    - Amount (via `formatUSD`)
    - Issue date, Due date (absolute "Apr 27, 2026" format)
    - GL category (if set)
    - Memo (if set) — full width, below the grid
  - Then a separator, then "Line items" heading, then a compact list of line items with description + amount.
  - Read-only; no inputs.

## Action bar

- [x] Create `src/features/bills/components/bill-action-bar.tsx`:
  - Props: `{ bill: BillWithRelations; currentUser: User; }`.
  - Uses `useBillMutations(bill.id)`.
  - Branches on `(bill.status, currentUser.role)`:
    - **DRAFT**: "Submit bill" primary button. Click → `mutations.submit.mutate(bill.id)`.
    - **PENDING_APPROVAL + APPROVER**: "Approve" primary + "Reject" secondary. Approve → `mutations.approve.mutate(bill.id)`. Reject → opens `<RejectBillDialog>`.
    - **PENDING_APPROVAL + SUBMITTER**: info row reading "Waiting on approver."
    - **APPROVED**: "Schedule payment" primary. Click → opens `<SchedulePaymentDialog>`.
    - **SCHEDULED**: "Send payment" primary with a secondary line "Scheduled for Apr 26 via ACH." Click → `mutations.pay.mutate(bill.id)`.
    - **PAID**: success block: green check + "Paid on Apr 26" + confirmation number.
    - **REJECTED**: muted block: "Rejected by Ada Chen on Apr 25" + rejection reason.
  - Registers `useHotkeys({ a: approve, r: openRejectDialog })` only when in the approve-eligible state.
  - Buttons show the hotkey in a `<kbd>` badge when applicable.

## Schedule payment dialog

- [x] Create `src/features/bills/components/schedule-payment-dialog.tsx`:
  - Props: `{ bill: BillWithRelations; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (payDate: Date, method: PaymentMethod) => void; }`.
  - Uses shadcn `Dialog`.
  - Date picker: `Popover` + `Calendar`, default to today + 2 days.
  - Method radio: ACH / Check, default to `bill.vendor.paymentMethod`.
  - Cancel + Confirm buttons. Confirm disabled when date is in the past.
  - On confirm: calls `onConfirm`, which triggers the schedule mutation and closes the dialog on success.

## Reject dialog

- [x] Create `src/features/bills/components/reject-bill-dialog.tsx`:
  - Props: `{ bill: BillWithRelations; open: boolean; onOpenChange: ...; onConfirm: (reason: string) => void; }`.
  - Uses shadcn `Dialog`.
  - `Textarea` for reason, labeled "Rejection reason", required, min 3 characters validated.
  - Red "Reject bill" button + Cancel.
  - On confirm: calls `onConfirm`, closes on mutation success.

## Activity timeline

- [x] Create `src/features/bills/components/bill-activity-timeline.tsx`:
  - Props: `{ events: BillEvent[] }`.
  - Fetches `trpc.user.list.useQuery()` to build an id → user map for actor names.
  - Renders chronologically oldest → newest as a vertical list with a left rail (CSS border).
  - Each event:
    - Circle marker on the rail.
    - Primary line: "{actorName} {verb}" (humanize verb: "created", "submitted", "approved", "rejected", "scheduled", "paid", "edited").
    - Secondary line (muted): relative time via `formatRelativeTime(createdAt)`.
    - For `rejected`: third line showing the reason from payload.
    - For `scheduled`: third line showing method + formatted pay date from payload.
    - For `paid`: third line showing the confirmation string from payload.

## Detail view composition

- [x] Create `src/features/bills/components/bill-detail-view.tsx`:
  - Client component.
  - Props: `{ initialBill: BillWithRelations; }`.
  - Calls `trpc.bill.get.useQuery({ id: initialBill.id }, { initialData: initialBill })` for live data.
  - Calls `trpc.user.current.useQuery()` via `useCurrentUser` for the role-gated action bar.
  - Layout: header row with back link + status pill + invoice number; then two-column grid: `<BillPdfViewer />` on left, stacked `<BillFields />` + `<BillActionBar />` + `<BillActivityTimeline />` on right.
  - Stack vertically on narrow viewports.

## Dynamic route page

- [x] Create `src/app/bills/[id]/page.tsx`:
  - Server Component.
  - `params: Promise<{ id: string }>` — Next.js 16 async params.
  - Uses `createCaller` from `src/server/root-router.ts` to fetch the bill server-side.
  - Calls `notFound()` from `next/navigation` if the bill doesn't exist.
  - Renders `<BillDetailView initialBill={bill} />`.
  - Exports `metadata` dynamically using `generateMetadata`: `title = "Bill {invoiceNumber || id} — Settle"`.
- [x] Add a `createCaller` factory in `src/server/root-router.ts` if it doesn't exist yet: `appRouter.createCaller(await createContext({...}))` — ensure the context-creation path works from a Server Component.

## Verification

- [ ] `npm run build` passes.
- [ ] Navigate to the inbox, click the Latham & Watkins PENDING_APPROVAL bill.
  - [ ] Detail page renders with PDF on left, fields on right.
  - [ ] Fields show: vendor, amount $12,500.00, dates, memo, line items.
  - [ ] Activity timeline shows `created` and `submitted` events.
- [ ] As Gus (SUBMITTER), action bar shows "Waiting on approver."
- [ ] Switch to Ada (APPROVER) via the top bar.
  - [ ] Action bar now shows Approve + Reject buttons.
  - [ ] Click Approve. Toast "Bill approved" appears. Status pill changes to "Approved." Timeline grows by one `approved` event.
- [ ] Switch back to Gus.
  - [ ] Action bar shows "Schedule payment."
  - [ ] Click it. Dialog opens with date defaulted to today+2 and method defaulted to ACH (vendor's preference).
  - [ ] Confirm. Toast "Payment scheduled." Status pill changes to "Scheduled." Timeline grows.
- [ ] Click "Send payment."
  - [ ] Toast "Payment sent." Status becomes "Paid."
  - [ ] Success block visible with confirmation number matching `SETTLE-\d+-[A-Z0-9]{6}`.
  - [ ] Timeline shows all five events chronologically.
- [ ] Keyboard:
  - [ ] Re-seed DB so a fresh PENDING_APPROVAL bill exists. Open it as Ada. Press `A` — bill approves. Press `R` on another pending bill — reject dialog opens.
  - [ ] Keyboard shortcuts do not fire while typing in the reject textarea.
- [ ] Error handling:
  - [ ] As Gus on a PENDING_APPROVAL bill, there's no Approve button — nothing to click. Good.
  - [ ] Manually fire an invalid mutation via console (e.g., `trpc.bill.pay.mutate(draftBillId)`) — red toast appears with the error message.
- [ ] Re-seed to a clean state before the next change. Confirm seed remains idempotent.
- [ ] Deploy to Vercel. Walk the same full demo path on the live URL.

## Definition of done

- All checkboxes above are ticked.
- The full demo path (create state already seeded → submit → approve → schedule → pay) can be driven entirely from the UI with no dev tools.
- Timeline is visually correct — chronological, legible, with the right secondary-line details per event type.
- `openspec validate --strict add-bill-detail` passes.
