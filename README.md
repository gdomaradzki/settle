# Settle

> The bill pay workflow for modern finance teams.

**Live demo:** https://getsettleapp.vercel.app

Settle is an accounts payable MVP. The product moves a bill through its lifecycle from intake, through approval, to payment, with an audit trail for every state transition.

---

## Try it in 90 seconds

The deployed app starts you signed in as Gus Silva (submitter). Ada Chen (CFO, approver) is available in the user switcher at the top right.

1. Open the **Bills** page. You'll see 14 seeded bills across all six lifecycle statuses. Click any row to see the detail view with the PDF pane, fields, action bar, and activity timeline.
2. From the inbox toolbar, click **+ New bill**. Drop a real invoice PDF onto the uploader. Claude extracts vendor, amount, dates, and line items from the actual PDF content. Review the form, click **Submit for approval**.
3. If a bill is above the $5,000 approval threshold, status becomes `PENDING_APPROVAL`. Switch to **Ada Chen** in the top bar and she can approve or reject.
4. Approve the bill (click or press `A`). Switch back to Gus. Schedule a payment, then send it. The timeline grows with each transition.
5. Visit the **Dashboard**, **Reports → AP Aging**, and **Vendors** to see the supporting surfaces.

## What Settle does

An AP product's job is to answer, at any moment: what do we owe, to whom, what needs attention, and what's going out the door this week. Settle implements that in a focused MVP:

- **Bill intake** through three paths: manual form, PDF upload with Claude-powered extraction, and CSV bulk upload.
- **Approval routing** with a single threshold rule. Bills at or above $5,000 require an approver. Below threshold, bills auto-approve on submit.
- **Payment scheduling** and simulated execution. The MVP flips status and stamps a fake confirmation number. There are no real ACH or check rails.
- **Per-bill activity timeline** sourced from an append-only event log, so every state transition is auditable.
- **Dashboard** with the three metrics a finance person scans every morning: what needs my approval, what's due this week, cash out next 30 days.
- **AP Aging Report** bucketed by days past due (current, 1 to 30, 31 to 60, 61+).

## Prioritized workflows

Ordered by what I built first:

1. Bill lifecycle state machine. `DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → PAID`, with `REJECTED` as a terminal branch. Every transition runs through one service, wrapped in a Prisma transaction alongside its audit event.
2. Bill inbox, the hero screen. Filter by status, due window, vendor, or "needs my approval." All filter state lives in the URL.
3. Bill detail with a contextual action bar (what you can do depends on status and role), keyboard shortcuts (`A` approve, `R` reject), and the activity timeline.
4. Intake paths: manual, PDF with extraction, CSV bulk.
5. Dashboard and AP aging report.
6. Vendors page with inline creation, reused across the intake form's vendor picker.

## What I cut, and why

Deliberate scope decisions, each with a one-line rationale:

| Cut | Reason |
|---|---|
| Real payment rails (ACH/check execution) | A status flip with a fake confirmation is honest and demo-complete. Real rails are an API integration exercise. |
| Accounting sync (QuickBooks, NetSuite, Xero) | Huge integration surface, zero demo value. |
| Multi-entity, multi-currency | USD only for the MVP. The currency column exists but is hardcoded. |
| Real auth, multi-tenancy | Fake user switcher instead. The eval is about product and systems, not rebuilding auth. |
| Email-to-bill ingestion (`@ap.settle.com`) | Email ingestion infra is its own project. |
| Line item splits and allocation templates | High implementation cost, invisible unless the reviewer explicitly opens a split modal. |
| Recurring bill payments | Scheduler plus recurrence rules plus idempotency. Stretch after stretch. |
| PO matching, duplicate detection, W-9 collection | Breadth without depth. |
| Audit exports, notifications, complex rules engine | Out of scope for the MVP. |

Short design sketches of splits and recurring bills are in the "What I'd build next" section at the bottom, since those two are the features a thoughtful AP eval would probe about.

## Setup

The live URL above is the demo. Running locally is optional.

### Requirements

- Node 22+
- An Anthropic API key (optional; without it, PDF extraction falls back to canned sample data matched by filename)

### Steps

```bash
git clone https://github.com/gdomaradzki/settle.git
cd settle
npm install

# Sync env vars from Vercel (you'll need to link a project, or manually populate .env.local)
vercel link
vercel env pull .env.local

# Or set these manually in .env.local:
#   DATABASE_URL          Neon pooled URL
#   DATABASE_URL_UNPOOLED Neon direct URL (for Prisma migrations)
#   ANTHROPIC_API_KEY     optional; enables real PDF extraction
#   BLOB_READ_WRITE_TOKEN optional; persists uploaded PDFs

npm run db:setup     # db:push + case-insensitive vendor index + seed (all three, in order)
npm run dev          # or `npm run build && npm start` for production mode
```

`db:setup` is idempotent — re-run it any time to reset demo data. The index step uses `CREATE UNIQUE INDEX IF NOT EXISTS` so it's safe to repeat. If you want finer control the three steps are also available individually: `db:push`, `db:case-index`, `db:seed`.

## Running tests

### Prerequisites

- Docker (for the isolated test database)
- Node 22+

### Test database

Tests run against a separate Postgres container on port 5433, completely isolated from the development database.

```bash
# Start the test DB (Docker required)
npm run testdb:up

# Create .env.test in the project root with:
# TEST_DATABASE_URL=postgresql://postgres:test@localhost:5433/test
```

The schema is applied automatically before the first test run via `prisma db push`. You don't need to run any migration step manually.

### Commands

| Command | What it runs |
|---|---|
| `npm test` | Vitest — all backend service, router, and component tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage report (threshold: 85% lines on `src/features/`) |
| `npm run test:e2e` | Playwright — full end-to-end suite against a running dev server |
| `npm run test:all` | Both Vitest and Playwright in sequence |

For the e2e suite, `npm run test:e2e` starts the dev server automatically on port 3001 (configured in `playwright.config.ts`). The first run compiles the app, so expect a 30–60 second startup.

### Test structure

- **Backend (service + router)** tests in `src/features/*/__tests__/` hit a real Postgres database. Each file calls `resetWithTruncate()` to clean up after every test.
- **Component** tests in `src/features/*/components/__tests__/` use React Testing Library under jsdom. tRPC calls are mocked via `src/test/mocks/trpc-client.ts`.
- **End-to-end** tests in `tests/e2e/` use Playwright against a seeded test database. The `setUser` helper in `tests/e2e/helpers.ts` switches users by injecting the session cookie directly, bypassing UI timing issues.

### CI

`.github/workflows/test.yml` runs the full suite on every push and pull request using a GitHub Actions Postgres service container.

## Architecture at a glance

- **Framework**: Next.js 16 (App Router) with TypeScript. One process, one deploy.
- **API layer**: tRPC. End-to-end types, shared zod schemas between forms and server.
- **ORM**: Prisma.
- **Database**: PostgreSQL via Neon (Vercel Postgres Marketplace integration). Scale-to-zero with sub-second resume.
- **UI**: Tailwind with shadcn/ui.
- **PDF extraction**: Claude via `@anthropic-ai/sdk` with a graceful fallback to canned sample data. Real extraction runs when `ANTHROPIC_API_KEY` is set. Otherwise the demo stays functional via filename-keyed canned data.
- **PDF storage**: Vercel Blob (1GB free on Hobby). Uploaded files get public URLs with random suffixes.
- **Testing**: Vitest for backend service and router tests (real Postgres, transactional isolation) and React Testing Library for component tests (jsdom, mocked tRPC). Playwright for end-to-end flows. All suites run against an isolated Docker Postgres, never the dev database.
- **Deploy**: Vercel.

### Project structure

Domain-driven. Each domain is self-contained.

```
src/
├── app/                          # Next.js App Router routes
├── components/                   # Cross-feature UI (shadcn primitives, top bar)
├── features/
│   ├── bills/                    # Schema, service (state machine), router, components, hooks
│   ├── vendors/
│   ├── users/
│   ├── approvals/                # Approval threshold constant and helpers
│   ├── intake/                   # Upload, extraction, CSV bulk
│   ├── dashboard/
│   └── reports/                  # AP aging
├── hooks/                        # Cross-feature hooks
├── lib/                          # formatUSD, date helpers
├── server/                       # Prisma client, tRPC bootstrap, root router
└── test/                         # Shared test utilities: factories, reset helpers, mocks
tests/
└── e2e/                          # Playwright end-to-end specs and helpers
```

Server-only files begin with `import 'server-only';` so misrouted client imports become build errors.

## Key data model decisions

**Money is stored as `Int` cents, with no exceptions.** Every monetary field on `Bill` and `BillLineItem` is an integer. Formatting happens at the UI edge via a single `formatUSD(cents)` helper.

**`BillEvent` is an append-only audit log, written in the same transaction as every state change.** The per-bill detail page's timeline renders straight from it, and the CSV-import source is distinguishable from manual creation via `event.payload.source = "csv"`. Every lifecycle transition in `bill-service.ts` wraps the bill update and the event insert in a single `db.$transaction`. If either fails, both roll back, and the audit log never diverges from truth.

**Lifecycle timestamps are denormalized onto `Bill` rows.** `submittedAt`, `approvedAt`, `scheduledPayDate`, `paidAt`, and similar fields are columns on `Bill` rather than joined from the event log. The dashboard queries "bills due this week" and "cash out next 30 days" need to be fast and index-friendly. Joining to `BillEvent` for every dashboard render would be a premature correctness optimization at the cost of real performance. `BillEvent` holds the narrative. The denormalized columns hold the shape.

**Bill status is a strict lifecycle, routed exclusively through one service.** The state machine lives in `src/features/bills/bill-service.ts`. Routers and UI components never touch `Bill.status` directly. This makes invariants (valid source status, required fields, audit logging) impossible to bypass.

## On process

Spec-driven. I used [OpenSpec](https://github.com/Fission-AI/OpenSpec) to decompose the build into around 13 discrete changes, each with a proposal, design, tasks list, and delta spec. The `openspec/` directory in this repo is the full audit trail. Active proposals live under `changes/`, consolidated per-domain specs under `specs/`, and archived changes under `changes/archive/` as historical record.

Planning was done with Claude Opus 4.7 as a thinking partner. Implementation ran through Claude Sonnet 4.6 in Claude Code, guided by each change's spec folder. This is the workflow I'd use on a production codebase today. Inspect `openspec/specs/` for the current contract and `openspec/changes/archive/` to see how each decision evolved.

Time budget: about 4 hours of focused work across planning, implementation, and polish.

## What I'd build next

**Line item splits and allocation templates.** A `LineItemAllocation` table cascaded off `BillLineItem` with a sum-equals-line constraint. One line ("Consulting, $30,000") allocates across multiple cost centers ($15k Eng, $10k Product, $5k Sales). Reusable templates (`AllocationTemplate` table) apply to new lines on matching vendors. Reporting then aggregates by department in addition to by vendor. I cut this because the implementation cost is meaningful and the feature is invisible until the reviewer opens a split modal. Poor ratio for a take-home.

**Recurring bills.** A `BillTemplate` model with RRULE-style recurrence, materialized into concrete `Bill` rows via Vercel Cron. Idempotency keyed on `(templateId, dueDate)` so the generator is safe to re-run. Mid-series cancellation via `cancelledAt` on the template. Instances after that date are skipped. Editing applies to future instances only unless the user opts to backport. I cut this because demo surface is near-zero (you can't click "wait a month" during an interview) and correctness is tricky at the edges.

**Real auth and multi-tenancy.** Replace the cookie-backed user switcher with a real session provider and scope every query by `orgId`. The tRPC context is already the right seam.

**Accounting sync.** Bidirectional sync to QuickBooks, NetSuite, or Xero. Every paid bill posts a journal entry. Reconciliation pulls cleared payments back. The line-item `EXPENSE` vs. `ITEM` classification already in the schema is the branch point. `ITEM` rows go to inventory sync; `EXPENSE` rows go directly to the P&L.

**Vendor name resolution.** Alias mapping so `"AWS"`, `"Amazon Web Services"`, and `"AMAZON WEB SERVICES, INC."` resolve to the same vendor during extraction and CSV import. Needed for real-world data where the same vendor's name varies across invoices and exports.

**Server-side pagination on the inbox.** Works fine at demo scale. Would fail at 10k bills.

**Optimistic UI on lifecycle mutations.** Would make clicks feel instant even on slow connections. Straightforward with React Query's `onMutate` and `onSettled` pattern.