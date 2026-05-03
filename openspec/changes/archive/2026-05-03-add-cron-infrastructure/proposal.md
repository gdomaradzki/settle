# Change: add-cron-infrastructure

## Why

Two upcoming features depend on a daily background process: scheduled bills must transition to PAID on their pay date, and recurring bill templates must generate new instances on their day-of-month. Settle currently has no scheduled-job infrastructure at all — without it, each feature would invent its own dispatcher and authentication.

This change introduces a single shared cron pipeline (one Vercel schedule, one route handler, one job registry) that both downstream features plug into. It contains no feature logic. Shipping it first lets `add-scheduled-payment-execution` and `add-recurring-bills` build against a stable foundation in parallel without coupling to each other.

## What changes

- **ADDED** `cron` domain: shared types in `src/server/cron/types.ts` defining `CronJob`, `CronContext`, and `JobResult`.
- **ADDED** `cron` domain: registry at `src/server/cron/registry.ts` exporting `cronRegistry: CronJob[]` (initially empty; downstream changes append entries).
- **ADDED** `cron` domain: runner at `src/server/cron/runner.ts` exporting `runAllJobs(ctx)` and `runJob(name, ctx)`. Both route handlers and the admin page funnel through these.
- **ADDED** Vercel cron schedule in `vercel.json` firing daily at `0 0 * * *` UTC against `/api/cron/daily`.
- **ADDED** route handler at `src/app/api/cron/daily/route.ts` that authenticates via `Authorization: Bearer <CRON_SECRET>`, calls `runAllJobs()`, and returns a JSON summary.
- **ADDED** route handler at `src/app/api/cron/trigger/route.ts` that authenticates with the same header and runs a single job named in the request body via `runJob()`. Same code path as `daily`.
- **ADDED** hidden admin page at `src/app/admin/cron/page.tsx` listing every registered job with a "Run now" button per job. The button is wired to a server action that invokes `runJob()` directly so `CRON_SECRET` never leaves the server.
- **ADDED** `CRON_SECRET` entry in `.env.example` with a one-line comment explaining its purpose and that Vercel auto-injects it when a cron is configured on the project.

## Impact

- Unblocks `add-scheduled-payment-execution` and `add-recurring-bills`. Each appends exactly one entry to `cronRegistry` and registers no new infrastructure.
- Establishes the contract every future scheduled job follows: input is a `CronContext`, output is a `JobResult` with `jobName`, `processed`, `skipped`, and `errors` fields.
- No user-visible change for the existing AP flows. `/admin/cron` renders an empty list until a feature registers its first job.

## Success criteria

- `vercel.json` defines exactly one cron schedule pointed at `/api/cron/daily` with the `0 0 * * *` schedule string.
- `curl -X POST $URL/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"` returns `200` and a JSON body `{ jobs: [] }` (empty until features land).
- The same call without the header (or with a wrong secret) returns `401` and an empty body.
- Visiting `/admin/cron` in the browser renders the heading "Scheduled jobs" and an empty list with no "Run now" buttons.
- `npm run build` passes clean. `npm run dev` boots without runtime errors.

## What this change does NOT do

- No business logic. No payments, no bill generation. Those land in the two downstream feature changes.
- No per-job scheduling. Every job runs daily at midnight UTC.
- No retry, queue, or fan-out infrastructure.
- No admin authentication beyond URL obscurity. Acceptable for MVP demo; called out as production-hardening work in the README.
