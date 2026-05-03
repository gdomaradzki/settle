import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, RepeatIcon } from "lucide-react";
import { createServerCaller } from "@/server/root-router";
import { formatUSD } from "@/lib/money";

export const metadata: Metadata = { title: "Recurring Bills — Settle" };

export default async function TemplatesPage() {
  const caller = await createServerCaller();
  const templates = await caller.templates.list();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold text-foreground">
          Recurring Bills
        </h1>
        <Link
          href="/templates/new"
          className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
          <PlusIcon className="size-3.5" />
          New recurring bill
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <RepeatIcon className="mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No recurring bills set up yet.
          </p>
          <Link
            href="/templates/new"
            className="mt-4 text-sm font-medium text-foreground underline underline-offset-2 hover:opacity-80">
            Create your first template
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {templates.map((t) => (
            <li key={t.id}>
              <Link
                href={`/templates/${t.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.vendor.name} &middot; pays day {t.paymentDayOfMonth} of each month
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-foreground">
                    {formatUSD(t.amountCents)}
                  </p>
                  {t.cancelledAt ? (
                    <span className="text-xs text-muted-foreground">
                      Cancelled
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Active
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
