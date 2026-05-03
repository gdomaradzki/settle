# Tasks: add-cron-infrastructure

## Infrastructure — Vercel and env

- [x] Add (or modify) `vercel.json` at the repo root to declare a single cron entry: path `/api/cron/daily`, schedule `0 0 * * *`. No other config changes in this file.
- [x] Append a `CRON_SECRET=` line to `.env.example` with a one-line comment describing the variable's purpose and that Vercel auto-injects it for cron invocations.
- [x] Document `CRON_SECRET` in the project README's environment-variables section if one exists (skip if not). — no README env-vars section, skipped per spec.

## Schema — types

- [x] Create `src/server/cron/types.ts`:
  - `import 'server-only';`
  - Export `CronContext` (`{ db, now: Date }`).
  - Export `JobResult` (`{ jobName, processed, skipped, errors: Array<{ id?: string; message: string }> }`).
  - Export `CronJob` (`{ name: string; description: string; run(ctx: CronContext): Promise<JobResult> }`).
  - No `export default`. No runtime values, types only.

## Service — registry and runner

- [x] Create `src/server/cron/registry.ts`:
  - `import 'server-only';`
  - Imports `CronJob` from `./types`.
  - Exports `cronRegistry: CronJob[] = []`.
  - File contains exactly that export plus the import — nothing else.
- [x] Create `src/server/cron/runner.ts`:
  - `import 'server-only';`
  - Exports `runAllJobs(ctx?: Partial<CronContext>): Promise<JobResult[]>`. If `ctx.db` is not supplied, defaults to the imported `db` singleton; if `ctx.now` is not supplied, defaults to `new Date()`.
  - Exports `runJob(name: string, ctx?: Partial<CronContext>): Promise<JobResult>`. Throws a `CronJobNotFoundError` if no job with that `name` exists.
  - Both functions wrap each `job.run(ctx)` in a try/catch; a thrown error becomes a `JobResult` with `processed: 0`, `skipped: 0`, and a single `errors` entry containing the error message.
  - Export `CronJobNotFoundError` from this file.

## Routes — daily and trigger handlers

- [x] Create `src/app/api/cron/daily/route.ts`:
  - Exports `POST(req)` only (no `GET`).
  - Validates `Authorization: Bearer <CRON_SECRET>` against `process.env.CRON_SECRET`. If absent, mismatched, or the env var itself is unset, return `401` with an empty body.
  - On success, calls `runAllJobs()` and returns `200` with body `{ jobs: JobResult[] }`.
  - File begins with `import 'server-only';`.
- [x] Create `src/app/api/cron/trigger/route.ts`:
  - Exports `POST(req)` only.
  - Same auth check as `daily`.
  - Reads `jobName` from a JSON body (`{ jobName: string }`); returns `400` if absent or non-string.
  - Calls `runJob(jobName)` and returns `200` with body `{ job: JobResult }`. Returns `404` (not 500) if the runner throws `CronJobNotFoundError`.
  - File begins with `import 'server-only';`.

## UI — admin page

- [x] Create `src/app/admin/cron/page.tsx`:
  - Server component (default export — Next.js requires it for page files).
  - Reads `cronRegistry` directly (server-only import is fine in a server component).
  - Renders a heading "Scheduled jobs" and a list of registered jobs. Each row shows `name`, `description`, and a "Run now" button.
  - Each "Run now" button is a `<form>` with a server action that calls `runJob(name)` and revalidates the page. The action handler is defined inline in the page file using `'use server'`; no separate file.
  - If `cronRegistry` is empty, render an empty-state block reading "No scheduled jobs registered."
  - The most recent summary (last `JobResult` per job, if any) is displayed below the run button. Stored in a per-request module-level cache or read from cookies — implementer's choice; the spec only requires that it renders, not how it persists.
  - No global `_layout.tsx` changes; page inherits the app's root layout.

## Verification

- [x] `npm run build` passes clean. No TypeScript errors. The empty `cronRegistry` does not produce unused-export warnings.
- [x] `npm run dev` boots without runtime errors.
- [x] `curl -X POST http://localhost:3000/api/cron/daily` (no auth header) returns HTTP 401.
- [x] `curl -X POST http://localhost:3000/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"` returns HTTP 200 with body `{"jobs":[]}` (empty array — no jobs registered yet).
- [x] `curl -X POST http://localhost:3000/api/cron/trigger -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" -d '{"jobName":"does-not-exist"}'` returns HTTP 404.
- [x] Visit `http://localhost:3000/admin/cron` — page renders with heading "Scheduled jobs" and the empty-state block "No scheduled jobs registered."
- [x] `openspec validate --strict add-cron-infrastructure` passes.

## Definition of done

- All checkboxes above are ticked.
- `cronRegistry` is empty in the merged commit; both downstream feature changes will append to it independently.
- The runner's try/catch wraps every job invocation. A failing job in one slot does not prevent other slots from running.
- `CRON_SECRET` is documented in `.env.example`. The repo never commits a real secret value.
