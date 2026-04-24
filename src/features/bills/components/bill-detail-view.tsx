'use client';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { BillStatusPill } from './bill-status-pill';
import { BillPdfViewer } from './bill-pdf-viewer';
import { BillFields } from './bill-fields';
import { BillActionBar } from './bill-action-bar';
import { BillActivityTimeline } from './bill-activity-timeline';
import type { BillWithRelations } from '../bill-service';

interface Props {
  initialBill: BillWithRelations;
}

export function BillDetailView({ initialBill }: Props) {
  const { data: raw } = trpc.bill.get.useQuery(initialBill.id, {
    initialData: initialBill,
  });
  const bill = (raw ?? initialBill) as BillWithRelations;

  const currentUser = useCurrentUser();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <Link
          href="/bills"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to bills
        </Link>
        <div className="flex items-center gap-3">
          <BillStatusPill status={bill.status} />
          {bill.invoiceNumber && (
            <span className="text-sm font-medium text-foreground">{bill.invoiceNumber}</span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 flex-col overflow-auto md:flex-row">
        {/* PDF column */}
        <div className="h-72 shrink-0 border-b border-border p-4 md:h-auto md:w-[55%] md:border-b-0 md:border-r">
          <BillPdfViewer
            pdfPath={bill.pdfPath}
            invoiceNumber={bill.invoiceNumber}
            id={bill.id}
          />
        </div>

        {/* Content column */}
        <div className="flex flex-1 flex-col gap-6 overflow-auto px-6 py-5">
          <BillFields bill={bill} />

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            {currentUser ? (
              <BillActionBar bill={bill} currentUser={currentUser} />
            ) : (
              <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Activity
            </p>
            <BillActivityTimeline events={bill.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
