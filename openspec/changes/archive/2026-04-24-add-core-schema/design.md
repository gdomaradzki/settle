# Design: add-core-schema

## Schema decisions

### Money as `Int` cents

All monetary fields (`Bill.amountCents`, `BillLineItem.amountCents`) are `Int`, representing cents. Rationale: floating-point arithmetic silently produces errors like `0.1 + 0.2 = 0.30000000000000004`. For a product whose entire job is moving money, that's unacceptable. Formatting to dollars happens at the UI edge via `formatUSD(cents)`.

### `BillEvent` audit log from day one

Every state transition writes a row to `BillEvent`. Three reasons:

1. **Timeline UX for free.** The per-bill detail page renders a chronological feed directly from this table.
2. **Mirrors how real AP systems work.** Ramp, Bill.com, and Brex all maintain event logs for compliance and support.
3. **Cheap insurance.** A separate table with append-only writes costs almost nothing and prevents needing to retrofit an audit log later.

### Denormalized lifecycle timestamps on `Bill`

`Bill` carries `submittedAt`, `approvedAt`, `rejectedAt`, `scheduledPayDate`, `paidAt` directly on the row, even though the same information can be derived from `BillEvent`. Rationale: the dashboard queries "bills due this week" and "cash out next 30 days" need to be indexable and fast. Joining to `BillEvent` for every dashboard render would be a premature correctness optimization at the cost of real query performance.

`BillEvent` is the narrative; the denormalized columns are the shape.

### GL category as `String?`, not a foreign key

A full Chart of Accounts with account codes, categories, parent relationships, and mapping rules is a rabbit hole that easily consumes a day. The MVP treats `glCategory` as free text (with a hardcoded shortlist in the UI). A future change can add a `GlAccount` model and migrate the column to a FK.

### Line items in a separate table, not JSON

`BillLineItem` is a proper table with `@OnDelete(Cascade)` from `Bill`. Storing line items as JSON on the bill would work for the MVP but blocks future per-line GL coding, per-line approvals, and reporting. One small table now is cheaper than a migration later.

Each line carries a `type: EXPENSE | ITEM` discriminator. In real AP systems, `EXPENSE` covers operational costs that hit the P&L immediately (consulting fees, SaaS subscriptions, utilities), while `ITEM` covers resellable goods that sync to inventory (stock purchases). The distinction matters for accounting sync — future QuickBooks/NetSuite integration will route the two types to different destinations. Defaulting to `EXPENSE` keeps the common case one click shorter.

### `cuid` IDs over UUIDs

Prisma's `@default(cuid())` produces shorter, URL-friendly IDs. No index-performance gain, just readability in URLs like `/bills/ckx9...`.

### Composite index on `(status, dueDate)`

The dashboard's hot path is "bills due this week" filtered by status. A composite index makes that query an index scan rather than a filter scan. Added from the start because it's a one-line cost.

---

## Database hosting — Neon via Vercel Postgres

Neon is provisioned through Vercel's Marketplace integration. Rationale:

- **Deployable to Vercel without a second DB provider.** One-click install from Vercel's Storage dashboard injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and related env vars into the project.
- **Scale-to-zero with <1s resume.** Important for a take-home where the evaluator might open the link days after submission. (Supabase's free tier pauses projects after 7 days of inactivity — different failure mode, visible to the reviewer as a dead link.)
- **Prisma works unchanged.** Standard Postgres dialect, standard connection string. The only adjustment is wiring `directUrl` for migrations:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DATABASE_URL_UNPOOLED")
  }
  ```
  Pooled URL for runtime queries (via Neon's PgBouncer-equivalent pooler); direct URL for DDL operations that don't survive the pooler.

**Dev/prod separation:** skipped for the MVP. A single Neon database backs both local dev and production. Safe because seed data is idempotent and there are no real users. Future work would branch the DB per environment using Neon's native branching feature — especially valuable for preview deployments, where each PR gets its own data-inclusive branch automatically.

## Migration strategy

- **`prisma db push` for this MVP.** No migration history is preserved; the seed script owns all sample data. The schema is still young and churning.
- **Switch to `prisma migrate dev`** the moment the product lives longer than the demo or any real data enters the system.
- Single `init` migration footprint if migrations are generated later.

---

## Seed design

`prisma/seed.ts` is idempotent: it wipes `BillEvent`, `BillLineItem`, `Bill`, `Vendor`, `User` in that order (respecting FKs), then reseeds. Safe to run repeatedly.

Dates are computed relative to `new Date()` so the demo always has:

- A couple of **overdue** bills (good for dashboard urgency)
- Several **due this week**
- A spread across the next 30 days

Amounts are hand-picked, not randomized, to showcase specific states:

- At least one bill with `amountCents >= 500_000` in `PENDING_APPROVAL` (demonstrates approval handoff in the demo)
- A mix of sub-threshold amounts that auto-approved
- Realistic ranges: $340 to $48,500

---

## Prisma client singleton

Next.js HMR will create new `PrismaClient` instances on every reload in dev, exhausting the connection pool. The singleton pattern:

```ts
// src/server/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Standard pattern; included here so the rule is documented, not folklore.

---

## What this change does **not** do

- No tRPC routers, no services, no state machine logic. State transitions are a `bills` capability concern and will be addressed in the next change (`add-bill-lifecycle`).
- No UI. No routes. No pages.
- No auth. The `User` table exists but nothing reads from it yet.
