import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { cronRegistry } from '@/server/cron/registry';
import { runJob } from '@/server/cron/runner';
import type { JobResult } from '@/server/cron/types';

export const metadata: Metadata = { title: 'Scheduled jobs — Settle' };

// Module-level cache: stores the most recent JobResult per job name.
// Resets on each cold start (per-deploy or per-serverless-instance).
const lastResults = new Map<string, JobResult>();

export default async function CronAdminPage() {
  const jobs = cronRegistry;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold text-foreground">
        Scheduled jobs
      </h1>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scheduled jobs registered.
        </p>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => {
            const last = lastResults.get(job.name);

            async function runNow() {
              'use server';
              const result = await runJob(job.name);
              lastResults.set(job.name, result);
              revalidatePath('/admin/cron');
            }

            return (
              <li
                key={job.name}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{job.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {job.description}
                    </p>
                  </div>

                  <form action={runNow} className="shrink-0">
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      Run now
                    </button>
                  </form>
                </div>

                {last && (
                  <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Last run: </span>
                    processed {last.processed} &middot; skipped {last.skipped}
                    {last.errors.length > 0 && (
                      <span className="ml-1 text-destructive">
                        &middot; {last.errors.length} error
                        {last.errors.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
