# Design: add-cron-infrastructure

## One pipeline, three entry points, one runner

All scheduled work in Settle flows through a single pipeline:

```
Vercel cron ───────► /api/cron/daily ─────┐
                                          │
curl with secret ──► /api/cron/trigger ───┼─► runner.ts ──► [job.run(ctx), ...]
                                          │
/admin/cron page ──► server action ───────┘
```

`src/server/cron/runner.ts` is the only module that knows how to invoke jobs. Everything else is a thin adapter. This guarantees the demo path and the production path share code — there is no separate "demo runner" that could drift.

## The registry pattern

`src/server/cron/registry.ts` exports a single mutable array:

```ts
import 'server-only';
import type { CronJob } from './types';

export const cronRegistry: CronJob[] = [
  // Downstream feature changes append exactly one entry here each.
];
```

Future changes register their jobs by appending to this array — `processScheduledPayments` from `add-scheduled-payment-execution`, `generateRecurringBills` from `add-recurring-bills`. The registry's *shape* is fixed by this change; only its *contents* grow.

This pattern was chosen over per-job route handlers (e.g., `/api/cron/process-scheduled-payments`) for three reasons:

1. **One Vercel cron schedule.** Adding a job is a code change, not a Vercel config change. The cron config and the code that runs are versioned together in one PR.
2. **Shared auth and observability.** The secret check, error catching, and JSON summary shape live in one place.
3. **Atomic deploys.** Rolling out a new job and the schedule that runs it cannot get out of sync, because there is only one schedule.

## Job contract

```ts
// src/server/cron/types.ts
import type { db as serverDb } from '@/server/db';

export type CronContext = {
  db: typeof serverDb;
  now: Date;
};

export type JobResult = {
  jobName: string;
  processed: number;
  skipped: number;
  errors: Array<{ id?: string; message: string }>;
};

export type CronJob = {
  name: string;
  description: string;
  run(ctx: CronContext): Promise<JobResult>;
};
```

`now` is injected (rather than read inside the job) so future tests can pin time without monkey-patching globals. `db` is injected so a future change that needs a different connection has a single touch-point.

## Idempotency is the job's responsibility

The infrastructure does not deduplicate. Each job's `run()` SHALL be safe to invoke twice in a row without producing duplicate side effects. Jobs achieve this through their own logic — typically a status filter that excludes already-processed rows (`processScheduledPayments`) or a unique constraint on the destination table (`generateRecurringBills`).

This contract matters because:

- Vercel may retry a failed cron invocation.
- The admin page's "Run now" button can be clicked twice in rapid succession during a demo.
- Local development re-runs the same job repeatedly.

If a job cannot guarantee idempotency, the design is wrong and should be revised before that job is registered.

## Authentication

`CRON_SECRET` is a single shared secret. It is checked at exactly two HTTP entry points:

1. `/api/cron/daily` — Vercel attaches `Authorization: Bearer $CRON_SECRET` automatically when invoking a configured schedule (https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs).
2. `/api/cron/trigger` — accepts the same header for parity, so a developer can test a single job via curl with the same secret.

The `/admin/cron` page does NOT cross the HTTP boundary. Its "Run now" button is wired to a Next.js server action that imports `runJob()` directly. This keeps `CRON_SECRET` on the server and avoids both embedding the secret in client markup and the awkwardness of a fetch loop that hits its own server.

The admin page is "hidden" only by URL obscurity. This is sufficient for the MVP demo per the project's broader simulated-auth posture; production hardening would gate the page behind an admin role.

### Why use `Bearer` and not a custom header?

Using `Authorization: Bearer` matches what Vercel sends out of the box. A custom header (`X-Cron-Secret`) would force a Vercel project setting to add the header, adding configuration drift across environments. Sticking with `Bearer` is zero-config and grep-able.

## Why a JSON summary, not just status codes

`/api/cron/daily` returns `{ jobs: JobResult[] }` rather than a bare `200 OK`. This pays for itself immediately:

- Vercel's cron logs persist the response body. A summary surface like `{ processed: 7, skipped: 3, errors: [] }` is the difference between "cron ran" and "cron actually did the right thing."
- During a demo, the admin page renders the most recent summary inline. The user sees what just happened, not just a green check.
- When the eventual second consumer (a status dashboard, a Slack notifier) is built, the contract is already in place.

## Error handling: catch per-job, never abort the loop

The runner wraps each `job.run(ctx)` call in a try/catch:

```ts
for (const job of cronRegistry) {
  try {
    results.push(await job.run(ctx));
  } catch (err) {
    results.push({
      jobName: job.name,
      processed: 0,
      skipped: 0,
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    });
  }
}
```

A throwing job does NOT abort the loop. Its failure is captured as a single-error JobResult, and subsequent jobs run normally. This is the right default for daily AP work — one broken job should not block the others.

Intra-job errors (e.g., one bill out of fifty fails) are the job's own concern: it accumulates them in its `errors` array and continues. The infrastructure only catches errors that escape the job entirely.

## File layout

```
src/
├── app/
│   ├── admin/cron/page.tsx          # Server component + server action
│   └── api/cron/
│       ├── daily/route.ts           # POST — Vercel cron entry point
│       └── trigger/route.ts         # POST — manual single-job trigger
└── server/cron/
    ├── types.ts                     # CronJob, CronContext, JobResult
    ├── registry.ts                  # export const cronRegistry: CronJob[]
    └── runner.ts                    # runAllJobs, runJob (catch + summarize)
```

Each file under `src/server/cron/` starts with `import 'server-only';` per project convention.

## What this change does NOT do

- **No business logic.** No `process-scheduled-payments`, no `generate-recurring-bills`. Those land in their respective feature changes.
- **No retry on failure.** If a job throws, the dispatcher catches the error, includes it in the summary, and continues. Failed jobs are not re-run within the same invocation.
- **No per-job scheduling.** Every job runs daily at midnight UTC. Per-job cadences would require either multiple Vercel cron entries or a within-day scheduling layer; neither is needed for the AP product's current jobs.
- **No queue, no backpressure, no fan-out.** Settle's job count is small and bounded. A registry is sufficient; a queue (Vercel Queues or otherwise) is the right tool only when jobs need to be parallelized across instances.
- **No admin auth beyond URL obscurity.** Acceptable for the MVP demo; called out as production-hardening work.
- **No vercel.ts migration.** The project currently uses `vercel.json`. Migrating to `vercel.ts` is a separate concern and would expand this change's blast radius needlessly.
