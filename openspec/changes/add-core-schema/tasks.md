# Tasks: add-core-schema

Tasks are ordered to be executed top-to-bottom. Each is small enough to review independently.

## Infrastructure

- [ ] Create a Vercel project and link the local repo: `vercel link`.
- [ ] From Vercel Dashboard → Storage, install the Neon integration (Vercel Postgres Marketplace). This provisions a Neon database and auto-injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and related vars into the Vercel project.
- [ ] Sync env vars locally: `vercel env pull .env.local`.
- [ ] Create `.env.example` at repo root documenting required vars:
  - `DATABASE_URL` — pooled connection, used by Prisma at runtime
  - `DATABASE_URL_UNPOOLED` — direct connection, used by Prisma for migrations and introspection
- [ ] Add `.env.local` and `.env` to `.gitignore` (check scaffold default).

## Prisma setup

- [ ] Install dependencies: `prisma`, `@prisma/client`.
- [ ] Run `npx prisma init` to scaffold `prisma/` and `schema.prisma`.
- [ ] Configure `datasource db` in `schema.prisma`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DATABASE_URL_UNPOOLED")
  }
  ```
  The `directUrl` is required so that `prisma db push` and migrations bypass Neon's connection pooler, which doesn't support all the DDL traffic Prisma emits.

## Schema — `users` capability

- [ ] Define `UserRole` enum: `SUBMITTER | APPROVER`.
- [ ] Define `User` model with: `id (cuid)`, `name`, `email (unique)`, `role`.

## Schema — `vendors` capability

- [ ] Define `PaymentMethod` enum: `ACH | CHECK`.
- [ ] Define `Vendor` model with: `id`, `name`, `email?`, `paymentMethod (default ACH)`, `achAccountLast4?`, `achRoutingLast4?`, `mailingAddress?`, `defaultGlCategory?`, `createdAt`.

## Schema — `bills` capability

- [ ] Define `BillStatus` enum: `DRAFT | PENDING_APPROVAL | APPROVED | SCHEDULED | PAID | REJECTED`.
- [ ] Define `Bill` model with:
  - Core: `id`, `vendorId (FK)`, `invoiceNumber?`, `amountCents (Int)`, `currency (default "USD")`, `issueDate`, `dueDate`, `status (default DRAFT)`, `memo?`, `glCategory?`, `pdfPath?`.
  - Lifecycle timestamps: `submittedAt?`, `approvedAt?`, `approvedById?`, `rejectedAt?`, `rejectedReason?`, `scheduledPayDate?`, `scheduledMethod?`, `paidAt?`, `paymentConfirmation?`.
  - Metadata: `createdById`, `createdAt`, `updatedAt`.
  - Relations: `vendor`, `lineItems`, `events`.
  - Indexes: `@@index([status, dueDate])`, `@@index([vendorId])`.
- [ ] Define `BillLineItem` model with: `id`, `billId (FK, cascade)`, `description`, `amountCents`, `type (LineItemType, default EXPENSE)`, `glCategory?`.
- [ ] Define `LineItemType` enum: `EXPENSE | ITEM`.
- [ ] Define `BillEvent` model with: `id`, `billId (FK, cascade)`, `type (String)`, `actorId (String)`, `payload (Json?)`, `createdAt`, index `@@index([billId, createdAt])`.

## Prisma client singleton

- [ ] Create `src/server/db.ts` exporting an HMR-safe Prisma client singleton.

## Seed script

- [ ] Create `prisma/seed.ts` that:
  - Wipes `BillEvent`, `BillLineItem`, `Bill`, `Vendor`, `User` in that order.
  - Inserts 2 users: Gus Silva (SUBMITTER), Ada Chen (APPROVER).
  - Inserts 5 vendors: AWS, WeWork, Latham & Watkins LLP, Notion Labs, Marcus Lee Design. Mix of ACH and CHECK payment methods.
  - Inserts ~14 bills distributed: 2 DRAFT, 3 PENDING_APPROVAL (with at least one ≥ $5,000), 2 APPROVED, 3 SCHEDULED, 3 PAID, 1 REJECTED.
  - Computes dates relative to `new Date()`: some overdue, several due this week, rest spread over 30 days.
  - For each bill, writes at least a `created` BillEvent. For bills past DRAFT, writes additional events matching their lifecycle history (e.g., a PAID bill has `created`, `submitted`, `approved`, `scheduled`, `paid`).
- [ ] Add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`.
- [ ] Add dev dependency: `tsx`.

## Verification

- [ ] Confirm `.env.local` contains non-empty `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- [ ] Run `npm run db:push` (`prisma db push`). All tables created in Neon, no errors.
- [ ] Run `npm run db:seed` (`prisma db seed`). No errors.
- [ ] Run `npx prisma studio`. Manually confirm:
  - 2 users with expected names and roles
  - 5 vendors with expected payment methods
  - ~14 bills with the expected status distribution
  - At least one PENDING_APPROVAL bill with amount ≥ $5,000
  - Every bill has at least one BillEvent
- [ ] Re-run `npm run db:seed`. It succeeds without violating FK constraints (idempotency check).
- [ ] Deploy to Vercel: `vercel --prod`. Confirm the build succeeds and the app boots (a later change will add pages; this one only needs the build to pass).

## Definition of done

- All checkboxes above are ticked.
- The repo can be cloned fresh, and a new engineer can run `vercel link && vercel env pull .env.local && npm install && npm run db:push && npm run db:seed` to reach the same state.
- `openspec validate --strict` passes for this change.
