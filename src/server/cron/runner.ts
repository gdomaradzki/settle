import 'server-only';
import { db } from '@/server/db';
import { cronRegistry } from './registry';
import type { CronContext, JobResult } from './types';

export class CronJobNotFoundError extends Error {
  constructor(name: string) {
    super(`Cron job not found: "${name}"`);
    this.name = 'CronJobNotFoundError';
  }
}

function buildContext(partial?: Partial<CronContext>): CronContext {
  return {
    db: partial?.db ?? db,
    now: partial?.now ?? new Date(),
  };
}

function catchToResult(jobName: string, err: unknown): JobResult {
  return {
    jobName,
    processed: 0,
    skipped: 0,
    errors: [{ message: err instanceof Error ? err.message : String(err) }],
  };
}

/**
 * Run every job in cronRegistry in order.
 * A throwing job produces a single-error JobResult; sibling jobs continue.
 * All jobs share the same ctx.now (set once before the loop begins).
 */
export async function runAllJobs(ctx?: Partial<CronContext>): Promise<JobResult[]> {
  const resolvedCtx = buildContext(ctx);
  const results: JobResult[] = [];

  for (const job of cronRegistry) {
    try {
      results.push(await job.run(resolvedCtx));
    } catch (err) {
      results.push(catchToResult(job.name, err));
    }
  }

  return results;
}

/**
 * Run a single job by name.
 * Throws CronJobNotFoundError if no job with that name exists.
 * A throwing job produces a single-error JobResult (does not re-throw).
 */
export async function runJob(name: string, ctx?: Partial<CronContext>): Promise<JobResult> {
  const job = cronRegistry.find((j) => j.name === name);
  if (!job) {
    throw new CronJobNotFoundError(name);
  }

  const resolvedCtx = buildContext(ctx);
  try {
    return await job.run(resolvedCtx);
  } catch (err) {
    return catchToResult(job.name, err);
  }
}
