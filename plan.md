# Settle — Implementation Plan

> The bill pay workflow for modern finance teams.

This is the north-star planning doc. For the day-to-day source of truth the agents read, see `openspec/config.yaml` and the change folders under `openspec/changes/`.

---

## 1. What we're building

Settle is an accounts payable (AP) product: the spine that moves a bill from "just received from a vendor" to "paid and recorded." Inspired by Ramp Bill Pay.

Every bill flows through one status machine:

```
DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → PAID
                ↘ REJECTED
```

The product's job is to make that pipeline **visible, fast, and auditable** — so a finance team knows at any moment what's owed, what needs their attention, and what's going out the door this week.

---

## 2. Prioritized workflows

**In scope**

1. **Bill intake (three paths)**
   - Manual form (`/bills/new`)
   - PDF upload → Claude extracts fields (with canned-sample fallback when `ANTHROPIC_API_KEY` is unset)
   - CSV bulk upload
2. **Bill coding** — amount, due date, vendor, GL category, memo, line items (with `EXPENSE | ITEM` classification per line)
3. **Approval routing** — one threshold rule: bills ≥ $5,000 require the CFO. Under $5k auto-approves on submit.
4. **Payment scheduling** — pick a pay date and method (ACH or Check).
5. **Payment execution** — "Send Payment" flips status to PAID, logs a fake confirmation number, records an event.
6. **Bill inbox** — filter by status, due window, needs-my-approval.
7. **Dashboard** — three tiles (Needs my approval · Due this week · Cash out next 30 days) + recent activity.
8. **Activity timeline per bill** — who did what, when. Free from the event table.
9. **User switcher in the top bar** — swap between a submitter and the CFO to demo the approval handoff.
10. **AP Aging Report** (stretch) — outstanding bills bucketed by 0–30 / 31–60 / 61–90 / 90+ days past due.

**Cut line — explicit, called out in README**

| Feature                                                                   | Why cut                                                                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real payment rails (ACH/check execution)                                  | Status flip + fake confirmation is honest and demo-complete                                                                                             |
| Accounting sync (QuickBooks, NetSuite, Xero)                              | Huge integration surface, no demo value                                                                                                                 |
| Multi-entity, multi-currency                                              | USD only for the MVP                                                                                                                                    |
| Real auth, multi-tenancy                                                  | Fake user switcher instead                                                                                                                              |
| AP email forwarding (@ap.settle.com)                                      | Requires email ingestion infra                                                                                                                          |
| **Line item splits & allocation templates**                               | High implementation cost, invisible unless the evaluator opens a split modal. Called out in the README with a one-paragraph explanation of the feature. |
| **Recurring bill payments**                                               | Scheduler + recurrence rules + idempotency. Stretch-after-stretch.                                                                                      |
| PO matching, duplicate detection, W-9 collection, vendor onboarding flows | Feature-breadth without demo value                                                                                                                      |
| Audit exports, notifications, complex rules engine                        | —                                                                                                                                                       |

---

## 3. Tech stack

| Layer          | Choice                                                            | Why                                                                                                    |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework      | Next.js 16 App Router + TypeScript                                | One process, one deploy, RSC where it helps                                                            |
| API            | tRPC                                                              | End-to-end types, zero wiring, no OpenAPI dance                                                        |
| ORM            | Prisma (with `directUrl` for migrations)                          | Schema doubles as data-model docs                                                                      |
| DB             | PostgreSQL via **Neon** (Vercel Postgres Marketplace integration) | Native Vercel integration, scale-to-zero with <1s resume                                               |
| LLM extraction | `@anthropic-ai/sdk` — Claude PDF input                            | Handles text-native and scanned invoices in one call. Falls back to canned samples when no key is set. |
| CSV parsing    | `papaparse`                                                       | Client-side parse + per-row zod validation                                                             |
| UI             | Tailwind + shadcn/ui                                              | Polished primitives, high design quality without time cost                                             |
| Forms          | react-hook-form + zod                                             | Shared schemas between form and tRPC                                                                   |
| Icons          | lucide-react                                                      |                                                                                                        |
| Deploy         | Vercel                                                            | Dev and prod share one Neon DB for the MVP                                                             |

No separate backend service. Next + tRPC covers the API surface.

PDF handling: uploaded files feed extraction in memory (Vercel's serverless fs is ephemeral). `Bill.pdfPath` points to canned samples under `/public/samples/` for the detail page's viewer. Production swap would be Vercel Blob.

---

## 4. Data model

See `openspec/changes/add-core-schema/tasks.md` for the authoritative schema task breakdown. Summary:

```
User              SUBMITTER | APPROVER
Vendor            with PaymentMethod enum (ACH | CHECK)
Bill              the full status machine + denormalized lifecycle timestamps
BillLineItem      with LineItemType enum (EXPENSE | ITEM)
BillEvent         append-only audit log, @@index([billId, createdAt])
```

Load-bearing decisions (see `openspec/changes/add-core-schema/design.md` for rationale):

- All money is `Int` cents. No exceptions.
- `BillEvent` is the audit log and the source of the per-bill timeline UI.
- Lifecycle timestamps denormalized onto `Bill` for fast dashboard queries; `BillEvent` holds narrative detail.
- GL category is free text, not an FK. Chart of Accounts is out of scope.
- Line items live in their own table (not JSON) with `type: EXPENSE | ITEM`.
- `cuid` IDs over UUIDs for readable URLs.
- Composite index on `(status, dueDate)` — the dashboard and inbox hot path.

---

## 5. API surface (tRPC)

```
auth
  .currentUser()               // reads from cookie-backed fake session
  .switchUser(userId)

vendor
  .list()
  .get(id)
  .create(input)

bill
  .list({ status?, dueBefore?, needsMyApproval?, search? })
  .get(id)                     // includes vendor, lineItems, events
  .create(input)               // saves DRAFT
  .createMany(input[])         // CSV bulk upload target
  .update(id, input)           // DRAFT only
  .submit(id)                  // DRAFT → PENDING_APPROVAL, or straight to APPROVED if < $5k
  .approve(id)                 // PENDING_APPROVAL → APPROVED (APPROVER role only)
  .reject(id, reason)          // PENDING_APPROVAL → REJECTED
  .schedule(id, { payDate, method })  // APPROVED → SCHEDULED
  .pay(id)                     // SCHEDULED → PAID, stamps confirmation

dashboard
  .summary()                   // counts + cash-out forecast buckets

report
  .apAging()                   // aging buckets for outstanding bills

intake
  .extractFromPdf(pdfBase64)   // Claude extraction with fallback
```

State transitions live exclusively in `src/features/bills/bill-service.ts`. Every mutation validates the source status, writes the destination fields, and appends a `BillEvent` in a single Prisma transaction. Routers never touch `Bill.status` directly.

---

## 6. Screens

**`/` — Dashboard.** Three tiles (live counts, each links to a pre-filtered `/bills` view). Recent activity feed below.

**`/bills` — Inbox (hero screen).** Filterable table. Status pill, vendor, amount, due date, age. Left sidebar filters. Search by invoice # or vendor. Row click → detail.

**`/bills/[id]` — Bill detail.** Two-column: PDF viewer on the left (iframe pointing at `/public/samples/…`), fields + line items + action bar + activity timeline on the right. Keyboard shortcuts: `A` approve, `R` reject, `Cmd+Enter` confirm modal.

**`/bills/new` — Create bill.** Upload PDF → extraction runs → fields prefill. Or enter manually. Line items have an `EXPENSE | ITEM` dropdown. Save as draft, or submit directly.

**`/bills/upload-csv` — CSV bulk upload.** File picker → papaparse → preview table with per-row zod validation → confirm to batch-insert as DRAFT.

**`/reports/ap-aging` — AP Aging Report.** Outstanding bills bucketed by 0–30 / 31–60 / 61–90 / 90+ days past due.

**`/vendors` — Vendor list.** Simple table. Add-vendor dialog.

**Top bar (global):** Logo, primary nav (Dashboard / Bills / Vendors / Reports), user switcher showing current role.

---

## 7. Seed data

Realistic enough to feel like a real company:

- **Users:** Gus Silva (SUBMITTER), Ada Chen (CFO / APPROVER).
- **Vendors (5):** AWS, WeWork, Latham & Watkins LLP, Notion Labs, Marcus Lee Design. Mix of ACH and Check.
- **Bills (~14) distributed across statuses:** 2 DRAFT, 3 PENDING_APPROVAL (at least one ≥ $5k), 2 APPROVED, 3 SCHEDULED, 3 PAID, 1 REJECTED.
- **Dates:** a couple overdue, several due this week, rest spread over 30 days.
- **Amounts:** cents-accurate, $340 to $48,500.

Seed script (`prisma/seed.ts`) is idempotent — safe to re-run.

---

## 8. Change priority (the critical path)

OpenSpec changes in dependency order. Each tier is self-contained; at the end of any tier the demo still tells a coherent story.

**Tier 1 — Foundation**

1. `add-core-schema` — Neon, Prisma, seed, Prisma singleton.
2. `add-bill-lifecycle` — `bill-service.ts` (in `src/features/bills/`) + tRPC mutations.
3. `add-app-shell` — layout, top bar, user switcher, tRPC provider.

**Tier 2 — Core demo (MVP)** 4. `add-bill-inbox` — list + filters at `/bills`. 5. `add-bill-detail` — detail page with action bar + timeline. 6. `add-bill-intake` — manual form + PDF upload + fallback extraction. Expense/Item dropdown lives here.

**Tier 3 — Product signal** 7. `add-dashboard` — tiles + recent activity. 8. `add-ap-aging-report` — highest-signal stretch feature.

**Tier 4 — Flourishes** 9. `add-ocr-extraction` — upgrade fallback to real Claude extraction (gated on `ANTHROPIC_API_KEY`). 10. `add-csv-bulk-upload` — bulk intake path, highest scope risk, cut first.

**Cut order if time runs short:** 10 → 9 → 8 → 7. Never cut into Tier 2.

**Parallelization:** After #1 lands, #2 and #3 run in parallel. After #3 lands, #4/#5 run in parallel. After #6 lands, #7/#8/#9 can all run in parallel.

---

## 9. Key decisions & tradeoffs

- **Real OCR via Claude PDF input, with graceful fallback.** One code path, no text-vs-image branching. Falls back to canned samples when no API key is set so the demo runs anywhere.
- **Faking payment rails.** A "Send Payment" button that flips status and generates a confirmation is honest and demo-complete.
- **One threshold approval rule, hardcoded.** A rules engine is a rabbit hole. The threshold lives in a constant (`APPROVAL_THRESHOLD_CENTS`); swapping it for a rules table later is mechanical.
- **No auth.** Fake user switcher. The eval is about product and systems, not NextAuth.
- **Events table from day one.** Tiny cost, huge payoff for the timeline UX and for conveying "I understand how AP systems actually work."
- **Neon over Supabase.** Supabase's free tier pauses after 7 days of inactivity — bad for a handoff an evaluator might open later. Neon's scale-to-zero resumes in <1s.
- **Prisma over Drizzle.** Schema file is half the documentation. Prisma's seed + migrate DX is stronger for this shape of project.
- **tRPC over REST.** Types flow through the stack without codegen.

---

## 10. Agent plan

Not splitting frontend/backend across agents — with tRPC the layers are too coupled and coordination overhead eats the win.

- **Main agent (continuous):** the critical path — schema, lifecycle, shell, detail, intake.
- **Side agent (one-shot, triggered when the parallelizable point in each tier is reached):** picks up one independent change at a time (inbox while detail is being built, dashboard while intake is being built, etc.).
- **Reviewer pass (one-shot, triggered when the core flow is demo-ready end to end):** catches bugs, dead code, missing loading states, inconsistent number formatting, unused imports. One focused pass, not continuous.

Each agent reads from `openspec/changes/<change-name>/` — proposal, design, tasks, specs. That folder IS the briefing; no other context handoff required.

---

## 11. README outline (for submission)

1. What Settle is (two sentences).
2. Workflows prioritized — the list from §2.
3. What was cut and why — the table in §2 cut line.
4. Setup: `npm install`, `vercel link`, `vercel env pull .env.local`, `npm run db:push && npm run db:seed`, `npm run dev`.
5. Live demo URL (Vercel deployment).
6. Demo walkthrough: "As Gus → create a bill over $5k → switch to Ada → approve → switch back → schedule → pay. Watch the timeline grow on the bill detail page."
7. Architecture notes: Next + tRPC + Prisma + Neon, status machine in one service, events table as audit log, Claude PDF extraction with graceful fallback.
8. What I'd build next if I had another day: line item splits & allocation templates, real accounting sync (QB), recurring bills, email ingestion.
