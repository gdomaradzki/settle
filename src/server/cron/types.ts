import 'server-only';
import type { db as serverDb } from '@/server/db';

/**
 * Context passed to every cron job's run() function.
 *
 * - `db` is the Prisma client singleton, injected so tests can supply a
 *   different connection without monkey-patching globals.
 * - `now` is the Date at which the dispatcher began its iteration, shared
 *   across all jobs in the same run. Jobs MUST use `ctx.now` rather than
 *   `new Date()` so that time can be pinned deterministically in tests.
 */
export type CronContext = {
  db: typeof serverDb;
  now: Date;
};

/**
 * The result returned by every cron job's run() function.
 *
 * - `jobName` mirrors the job's registered name.
 * - `processed` is the count of records acted upon.
 * - `skipped` is the count of records deliberately skipped (e.g. already done).
 * - `errors` is always present, even when empty. Per-record errors carry the
 *   record's `id` when available.
 */
export type JobResult = {
  jobName: string;
  processed: number;
  skipped: number;
  errors: Array<{ id?: string; message: string }>;
};

/**
 * Contract for every scheduled job registered in cronRegistry.
 *
 * IDEMPOTENCY CONTRACT: Every job's run() MUST be safe to invoke twice in a
 * row without producing duplicate side effects. The infrastructure does not
 * enforce idempotency; jobs achieve it through their own logic (status filters
 * that exclude already-processed rows, unique constraints on destination
 * tables, etc.).
 */
export type CronJob = {
  name: string;
  description: string;
  run(ctx: CronContext): Promise<JobResult>;
};
