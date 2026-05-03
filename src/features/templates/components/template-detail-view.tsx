"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { formatUSD } from "@/lib/money";
import { formatAbsoluteDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { BillStatusPill } from "@/features/bills/components/bill-status-pill";
import type { BillStatus } from "@/generated/prisma/enums";

type BillInstance = {
  id: string;
  dueDate: Date;
  status: string;
};

type UpcomingOccurrence = {
  payDate: Date;
  generationDate: Date;
  isLast: boolean;
};

type TemplateData = {
  id: string;
  description: string;
  amountCents: number;
  paymentDayOfMonth: number;
  memo: string | null;
  glCategory: string | null;
  endsAt: Date | null;
  maxOccurrences: number | null;
  requireApprovalPerInstance: boolean;
  cancelledAt: Date | null;
  createdAt: Date;
  vendor: { id: string; name: string };
  lineItems: { id: string; description: string; amountCents: number }[];
  upcomingBills: BillInstance[];
  pastBills: BillInstance[];
  upcoming: UpcomingOccurrence[];
};

type UpcomingRow =
  | { kind: "bill"; payDate: Date; bill: BillInstance }
  | { kind: "forecast"; payDate: Date; occurrence: UpcomingOccurrence };

const UPCOMING_INITIAL = 6;

interface Props {
  initialTemplate: TemplateData;
}

export function TemplateDetailView({ initialTemplate }: Props) {
  const [template, setTemplate] = useState(initialTemplate);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const utils = trpc.useUtils();
  const router = useRouter();

  const generate = trpc.templates.runGenerationForOne.useMutation({
    onSuccess: async () => {
      toast.success("Bill instance generated successfully.");
      const updated = await utils.templates.get.fetch(template.id);
      if (updated) setTemplate(updated as unknown as TemplateData);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(
          "An instance for this template and due date already exists.",
        );
      } else {
        toast.error(err.message ?? "Something went wrong.");
      }
    },
  });

  const cancel = trpc.templates.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Template cancelled.");
      const updated = await utils.templates.get.fetch(template.id);
      if (updated) setTemplate(updated as unknown as TemplateData);
    },
    onError: (err) => {
      toast.error(err.message ?? "Something went wrong.");
    },
  });

  const isCancelled = !!template.cancelledAt;
  const isPending = generate.isPending || cancel.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/templates"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          Recurring Bills
        </Link>
        <h1 className="text-lg font-semibold text-foreground">
          {template.description}
        </h1>
        {isCancelled && (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Cancelled
          </span>
        )}
      </div>

      {/* Template fields */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Vendor</dt>
            <dd className="mt-0.5 text-foreground">{template.vendor.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Amount</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatUSD(template.amountCents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Pay vendor on
            </dt>
            <dd className="mt-0.5 text-foreground">
              Day {template.paymentDayOfMonth}
            </dd>
          </div>
          {template.endsAt && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Ends on
              </dt>
              <dd className="mt-0.5 text-foreground">
                {formatAbsoluteDate(new Date(template.endsAt))}
              </dd>
            </div>
          )}
          {template.maxOccurrences !== null && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Max occurrences
              </dt>
              <dd className="mt-0.5 text-foreground">
                {template.maxOccurrences} (
                {template.upcomingBills.length + template.pastBills.length} so
                far)
              </dd>
            </div>
          )}
          {template.requireApprovalPerInstance && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                Approval
              </dt>
              <dd className="mt-0.5 text-foreground">
                Each cycle requires approval before scheduling.
              </dd>
            </div>
          )}
          {template.glCategory && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                GL category
              </dt>
              <dd className="mt-0.5 text-foreground">{template.glCategory}</dd>
            </div>
          )}
          {template.memo && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Memo</dt>
              <dd className="mt-0.5 text-foreground">{template.memo}</dd>
            </div>
          )}
        </dl>

        {/* Line items */}
        {template.lineItems.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">
              Line items
            </p>
            <ul className="space-y-1">
              {template.lineItems.map((li) => (
                <li
                  key={li.id}
                  className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{li.description}</span>
                  <span className="text-muted-foreground">
                    {formatUSD(li.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mb-8 flex gap-3 flex-wrap">
        <Button
          variant="outline"
          disabled={isCancelled || isPending}
          onClick={() => generate.mutate(template.id)}>
          {generate.isPending ? "Generating…" : "Generate next instance now"}
        </Button>
        {!isCancelled && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => router.push(`/templates/${template.id}/edit`)}>
            Edit
          </Button>
        )}
        {!isCancelled && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={() => cancel.mutate(template.id)}>
            {cancel.isPending ? "Cancelling…" : "Cancel template"}
          </Button>
        )}
      </div>

      {/* Cancelled notice */}
      {isCancelled && template.cancelledAt && (
        <div className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          Cancelled on {formatAbsoluteDate(new Date(template.cancelledAt))}
        </div>
      )}

      {/* Upcoming: in-flight bills + forecast pay dates, merged by date */}
      {(() => {
        if (isCancelled) return null;

        const merged: UpcomingRow[] = [
          ...template.upcomingBills.map(
            (b): UpcomingRow => ({
              kind: "bill",
              payDate: new Date(b.dueDate),
              bill: b,
            }),
          ),
          ...template.upcoming.map(
            (u): UpcomingRow => ({
              kind: "forecast",
              payDate: new Date(u.payDate),
              occurrence: u,
            }),
          ),
        ].sort((a, b) => a.payDate.getTime() - b.payDate.getTime());

        if (merged.length === 0) return null;

        const visible = showAllUpcoming
          ? merged
          : merged.slice(0, UPCOMING_INITIAL);
        const hidden = merged.length - UPCOMING_INITIAL;

        return (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Upcoming
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {visible.map((row) => {
                if (row.kind === "bill") {
                  return (
                    <li key={row.bill.id}>
                      <Link
                        href={`/bills/${row.bill.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                        <span className="text-sm text-foreground">
                          Pays {formatAbsoluteDate(row.payDate)}
                        </span>
                        <BillStatusPill
                          status={row.bill.status as BillStatus}
                        />
                      </Link>
                    </li>
                  );
                }
                return (
                  <li
                    key={`forecast-${row.payDate.toISOString()}`}
                    className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="text-sm text-foreground">
                      Pays {formatAbsoluteDate(row.payDate)}
                      {row.occurrence.isLast && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (last)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Generates{" "}
                      {formatAbsoluteDate(
                        new Date(row.occurrence.generationDate),
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAllUpcoming((v) => !v)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showAllUpcoming ? "Show fewer" : `Show ${hidden} more`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Past: only finalized (PAID, REJECTED) bills */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Past instances
        </h2>
        {template.pastBills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past instances yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {template.pastBills.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bills/${b.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                  <span className="text-sm text-foreground">
                    Paid {formatAbsoluteDate(new Date(b.dueDate))}
                  </span>
                  <BillStatusPill status={b.status as BillStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
