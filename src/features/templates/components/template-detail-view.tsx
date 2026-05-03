"use client";
import { useState } from "react";
import Link from "next/link";
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

type TemplateData = {
  id: string;
  description: string;
  amountCents: number;
  paymentDayOfMonth: number;
  memo: string | null;
  glCategory: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  vendor: { id: string; name: string };
  lineItems: { id: string; description: string; amountCents: number }[];
  bills: BillInstance[];
};

interface Props {
  initialTemplate: TemplateData;
}

export function TemplateDetailView({ initialTemplate }: Props) {
  const [template, setTemplate] = useState(initialTemplate);
  const utils = trpc.useUtils();

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

      {/* Past instances */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Past instances
        </h2>
        {template.bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No instances yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {template.bills.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bills/${b.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                  <span className="text-sm text-foreground">
                    Due {formatAbsoluteDate(new Date(b.dueDate))}
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
