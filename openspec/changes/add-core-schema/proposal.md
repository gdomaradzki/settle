# Change: add-core-schema

## Why

Every downstream capability (bills, vendors, approvals, payments, dashboard) reads from or writes to the database. Nothing can ship until the schema exists, the first migration runs, and seed data is in place. This change creates that foundation and nothing more — no UI, no business logic, no tRPC routers.

## What changes

- **ADDED** `bills` domain: the `Bill` model, its status enum, line items (with `EXPENSE | ITEM` type), and the `BillEvent` audit log.
- **ADDED** `vendors` domain: the `Vendor` model and payment method enum.
- **ADDED** `users` domain: the `User` model and role enum.
- **ADDED** seed data representing the demo scenario: 2 users, 5 vendors, ~14 bills across statuses.
- **ADDED** Neon database provisioned via Vercel Postgres Marketplace integration.
- **ADDED** Prisma client singleton at `src/server/db.ts`.

## Impact

- Unblocks all subsequent changes.
- No user-visible outcome in this change. Validation: `npm run db:seed` runs cleanly and seeded data is visible in Prisma Studio.
- No breaking changes — this is the first change in a greenfield project.

## Success criteria

- `vercel env pull .env.local` populates `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- `npm run db:push` creates all tables in Neon without errors.
- `npm run db:seed` populates 2 users, 5 vendors, and ~14 bills spread across all six statuses.
- At least one bill has `amountCents >= 500_000` and sits in `PENDING_APPROVAL` (demonstrates the approval threshold).
- Every bill has at least one `BillEvent` of type `created`.
- `src/server/db.ts` exports a Prisma client singleton that survives Next.js HMR.
- `vercel --prod` builds and deploys successfully (the app has no pages yet; the build just needs to pass).
