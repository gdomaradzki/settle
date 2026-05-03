# cron Specification

## Purpose
TBD - created by archiving change add-cron-infrastructure. Update Purpose after archive.
## Requirements
### Requirement: A single Vercel cron schedule fires daily at midnight UTC

The system SHALL declare exactly one cron entry in `vercel.json` with path `/api/cron/daily` and schedule `0 0 * * *`. The system SHALL NOT define additional Vercel cron entries; per-job cadences are achieved by registering jobs with the dispatcher, not by adding schedules.

#### Scenario: vercel.json contains the daily schedule

- **GIVEN** the project is deployed to Vercel
- **WHEN** `vercel.json` is inspected
- **THEN** it contains a `crons` array with exactly one entry
- **AND** that entry's `path` is `/api/cron/daily`
- **AND** that entry's `schedule` is `0 0 * * *`

### Requirement: The daily cron route handler authenticates via CRON_SECRET

The system SHALL, on every request to `/api/cron/daily`, verify that the `Authorization` header equals `Bearer ${CRON_SECRET}` where `CRON_SECRET` is read from `process.env.CRON_SECRET`. If the header is missing, malformed, or its value does not match, the handler SHALL respond with HTTP `401` and an empty body. If the `CRON_SECRET` env var is unset, the handler SHALL also respond with `401` (never with `500`).

#### Scenario: Missing Authorization header is rejected

- **GIVEN** the cron route handler is deployed
- **WHEN** a request to `POST /api/cron/daily` arrives without an `Authorization` header
- **THEN** the response status is `401`
- **AND** the response body is empty

#### Scenario: Wrong secret is rejected

- **GIVEN** `CRON_SECRET` is set to `"correct"`
- **WHEN** a request arrives with `Authorization: Bearer wrong`
- **THEN** the response status is `401`

#### Scenario: Correct secret is accepted

- **GIVEN** `CRON_SECRET` is set to `"correct"`
- **WHEN** a request arrives with `Authorization: Bearer correct`
- **THEN** the response status is `200`
- **AND** the response body is JSON with a top-level `jobs` array

### Requirement: The daily handler dispatches every registered job in sequence

The system SHALL, on an authenticated request to `/api/cron/daily`, iterate `cronRegistry` and invoke each job's `run(ctx)` function. The system SHALL return a JSON response of the form `{ jobs: JobResult[] }` where the array order matches the registry order.

#### Scenario: Empty registry returns an empty jobs array

- **GIVEN** `cronRegistry` contains zero entries
- **WHEN** an authenticated request hits `/api/cron/daily`
- **THEN** the response is `{ "jobs": [] }`

#### Scenario: Registry order is preserved in the response

- **GIVEN** `cronRegistry` contains two jobs registered in the order [A, B]
- **WHEN** an authenticated request hits `/api/cron/daily`
- **THEN** `response.jobs[0].jobName` equals `"A"`
- **AND** `response.jobs[1].jobName` equals `"B"`

### Requirement: A job that throws does not abort sibling jobs

The system SHALL wrap every `job.run(ctx)` invocation in the runner with a try/catch. A thrown error SHALL be captured as a `JobResult` with `processed: 0`, `skipped: 0`, and a single entry in `errors` containing the error message. Sibling jobs in the same dispatcher invocation SHALL continue to run normally.

#### Scenario: One job throws, the next still runs

- **GIVEN** `cronRegistry` contains two jobs [A, B] in that order
- **AND** job A's `run()` throws `new Error("boom")`
- **AND** job B's `run()` resolves normally with `{ processed: 1, skipped: 0, errors: [] }`
- **WHEN** an authenticated request hits `/api/cron/daily`
- **THEN** the response status is `200`
- **AND** `response.jobs[0]` equals `{ jobName: "A", processed: 0, skipped: 0, errors: [{ message: "boom" }] }`
- **AND** `response.jobs[1].jobName` equals `"B"` and `response.jobs[1].processed` equals `1`

### Requirement: Manual trigger handler runs a single job by name

The system SHALL expose `POST /api/cron/trigger` that accepts a JSON body `{ jobName: string }`, authenticates with the same `Bearer ${CRON_SECRET}` header as `/api/cron/daily`, and invokes only that job's `run(ctx)`. The response SHALL be `{ job: JobResult }`. If `jobName` is missing, non-string, or empty, the handler SHALL respond `400`. If no job with that name exists in the registry, the handler SHALL respond `404`.

#### Scenario: Triggering an existing job runs it once

- **GIVEN** `cronRegistry` contains a job named `"sync-vendors"` whose `run()` returns `{ processed: 3, skipped: 0, errors: [] }`
- **WHEN** an authenticated POST hits `/api/cron/trigger` with body `{ "jobName": "sync-vendors" }`
- **THEN** the response status is `200`
- **AND** `response.job.jobName` equals `"sync-vendors"`
- **AND** `response.job.processed` equals `3`

#### Scenario: Triggering an unknown job returns 404

- **GIVEN** `cronRegistry` contains no job named `"nope"`
- **WHEN** an authenticated POST hits `/api/cron/trigger` with body `{ "jobName": "nope" }`
- **THEN** the response status is `404`

#### Scenario: Missing jobName field returns 400

- **GIVEN** any cron registry contents
- **WHEN** an authenticated POST hits `/api/cron/trigger` with body `{}`
- **THEN** the response status is `400`

### Requirement: The cron job registry is the only place jobs are enrolled

The system SHALL maintain a single registry array `cronRegistry: CronJob[]` exported from `src/server/cron/registry.ts`. Every scheduled job SHALL be added by appending an entry to this array. The system SHALL NOT introduce parallel registries, decorator-based registration, or per-route cron handlers.

#### Scenario: Adding a new job requires only a registry append

- **GIVEN** a developer wants to add a new scheduled job
- **WHEN** they create the job's module exporting a `CronJob` value
- **THEN** the only edit to existing infrastructure is appending one entry to `cronRegistry`
- **AND** no changes to `vercel.json`, the route handlers, the runner, or the admin page are required

### Requirement: Every cron job result conforms to a fixed shape

The system SHALL define `JobResult` as `{ jobName: string; processed: number; skipped: number; errors: Array<{ id?: string; message: string }> }` and require every registered job to return a value of this shape. The `errors` array SHALL always be present, even when empty. Each error entry SHALL carry a human-readable `message`; when the error is associated with a specific record, the entry SHOULD also carry that record's `id`.

#### Scenario: A successful no-op run returns a well-formed empty result

- **GIVEN** a registered job whose run finds nothing to do
- **WHEN** the job is invoked
- **THEN** the returned object equals `{ jobName: "<the-job-name>", processed: 0, skipped: 0, errors: [] }`

### Requirement: Cron jobs are required to be idempotent

The system SHALL document, in `src/server/cron/types.ts` or alongside the `CronJob` type, that every job's `run()` MUST be safe to invoke twice in a row. The infrastructure SHALL NOT enforce idempotency at the dispatcher level; jobs achieve it through their own logic (status filters that exclude already-processed rows, unique constraints on destination tables, etc.).

#### Scenario: Running a job twice in a row produces the same outcome

- **GIVEN** a registered job has just completed successfully against a stable input set
- **WHEN** the job's `run()` is invoked a second time without any external state change
- **THEN** no additional side effects (new rows, status transitions, external calls) are produced
- **AND** the returned `JobResult` reports `processed: 0` (or whatever count reflects only newly-eligible work, which is zero in this case)

### Requirement: Cron context injects time and database

The system SHALL invoke every `run()` with a `CronContext` containing at minimum `db` (the Prisma client) and `now: Date`. The `now` value SHALL be the time at which the dispatcher began the iteration, not the time the individual job is invoked. Jobs SHALL use `ctx.now` rather than `new Date()` so that future tests can pin time deterministically.

#### Scenario: All jobs in one dispatcher run see the same `now`

- **GIVEN** `cronRegistry` contains two jobs A and B
- **WHEN** the runner dispatches them in sequence
- **THEN** `ctx.now` passed to A is identical (`===` by reference equality of the Date instance, or equal by `getTime()`) to `ctx.now` passed to B

### Requirement: A hidden admin page lists registered jobs and triggers them in-process

The system SHALL render at `/admin/cron` a server component that reads `cronRegistry` and lists every registered job with its `name`, `description`, and a "Run now" button. The button SHALL invoke a Next.js server action that calls `runJob(name)` directly (not via HTTP), so `CRON_SECRET` is never exposed in client markup or network traffic.

#### Scenario: Empty registry shows an empty state

- **GIVEN** `cronRegistry` contains zero entries
- **WHEN** the user visits `/admin/cron`
- **THEN** the page renders the heading "Scheduled jobs"
- **AND** the body shows "No scheduled jobs registered."
- **AND** no "Run now" buttons are rendered

#### Scenario: Each registered job gets a row with a button

- **GIVEN** `cronRegistry` contains a single job `{ name: "process-X", description: "Does X", run: ... }`
- **WHEN** the user visits `/admin/cron`
- **THEN** the page renders one row containing the text "process-X" and "Does X"
- **AND** the row contains a button labeled "Run now"

#### Scenario: Clicking "Run now" invokes the job and refreshes the page

- **GIVEN** the user is on `/admin/cron` with a registered job
- **WHEN** the user clicks "Run now" for that job
- **THEN** the underlying server action calls `runJob(name)` (not an HTTP fetch)
- **AND** the page re-renders showing the latest `JobResult` for that job

