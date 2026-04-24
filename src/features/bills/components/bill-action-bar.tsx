'use client';
import { useState } from 'react';
import { CheckCircle2Icon, ClockIcon, XCircleIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { formatAbsoluteDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useBillMutations } from '../hooks/use-bill-mutations';
import { SchedulePaymentDialog } from './schedule-payment-dialog';
import { RejectBillDialog } from './reject-bill-dialog';
import type { BillWithRelations } from '../bill-service';

interface Props {
  bill: BillWithRelations;
  currentUser: { id: string; role: string };
}

export function BillActionBar({ bill, currentUser }: Props) {
  const mutations = useBillMutations(bill.id);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const isApprover = currentUser.role === 'APPROVER';
  const canApprove = bill.status === 'PENDING_APPROVAL' && isApprover;

  useHotkeys(
    {
      a: () => { if (canApprove) mutations.approve.mutate(bill.id); },
      r: () => { if (canApprove) setRejectOpen(true); },
    },
    canApprove,
  );

  if (bill.status === 'DRAFT') {
    return (
      <div className="flex items-center gap-3">
        <Button
          onClick={() => mutations.submit.mutate(bill.id)}
          disabled={mutations.submit.isPending}
          className="w-full sm:w-auto"
        >
          {mutations.submit.isPending ? 'Submitting…' : 'Submit bill'}
        </Button>
      </div>
    );
  }

  if (bill.status === 'PENDING_APPROVAL') {
    if (!isApprover) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon className="size-4 shrink-0" />
          Waiting on approver
        </div>
      );
    }
    return (
      <>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => mutations.approve.mutate(bill.id)}
            disabled={mutations.approve.isPending}
          >
            Approve
            <kbd className="ml-2 hidden text-[10px] opacity-60 sm:inline">A</kbd>
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={mutations.reject.isPending}
          >
            Reject
            <kbd className="ml-2 hidden text-[10px] opacity-60 sm:inline">R</kbd>
          </Button>
        </div>
        <RejectBillDialog
          bill={bill}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onConfirm={(reason) =>
            mutations.reject.mutate(
              { billId: bill.id, reason },
              { onSuccess: () => setRejectOpen(false) },
            )
          }
          isPending={mutations.reject.isPending}
        />
      </>
    );
  }

  if (bill.status === 'APPROVED') {
    return (
      <>
        <Button onClick={() => setScheduleOpen(true)} className="w-full sm:w-auto">
          Schedule payment
        </Button>
        <SchedulePaymentDialog
          bill={bill}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          onConfirm={(payDate, method) =>
            mutations.schedule.mutate(
              { billId: bill.id, payDate, method },
              { onSuccess: () => setScheduleOpen(false) },
            )
          }
          isPending={mutations.schedule.isPending}
        />
      </>
    );
  }

  if (bill.status === 'SCHEDULED') {
    return (
      <div className="space-y-2">
        <Button
          onClick={() => mutations.pay.mutate(bill.id)}
          disabled={mutations.pay.isPending}
          className="w-full sm:w-auto"
        >
          {mutations.pay.isPending ? 'Processing…' : 'Send payment'}
        </Button>
        {bill.scheduledPayDate && (
          <p className="text-xs text-muted-foreground">
            Scheduled for {formatAbsoluteDate(new Date(bill.scheduledPayDate))}
            {bill.scheduledMethod && ` via ${bill.scheduledMethod}`}
          </p>
        )}
      </div>
    );
  }

  if (bill.status === 'PAID') {
    return (
      <div className={cn('flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30')}>
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Paid{bill.paidAt ? ` on ${formatAbsoluteDate(new Date(bill.paidAt))}` : ''}
          </p>
          {bill.paymentConfirmation && (
            <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              {bill.paymentConfirmation}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (bill.status === 'REJECTED') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Rejected{bill.rejectedAt ? ` on ${formatAbsoluteDate(new Date(bill.rejectedAt))}` : ''}
          </p>
          {bill.rejectedReason && (
            <p className="text-xs text-red-600 dark:text-red-400">{bill.rejectedReason}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <AlertCircleIcon className="size-4" />
      No actions available
    </div>
  );
}
