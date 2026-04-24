'use client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc-client';
import type { BillWithVendor } from '@/features/bills/bill-service';
import { formatUSD } from '@/lib/money';
import { formatRelativeDueDate, formatTimeAgo } from '@/lib/dates';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BillStatusPill } from './bill-status-pill';
import { useBillFilters } from '../hooks/use-bill-filters';
import { filterOverdue } from '../lib/overdue';
import type { DueWindow } from '../hooks/use-bill-filters';

function getMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dueBeforeFromWindow(window: DueWindow): Date | undefined {
  if (!window) return undefined;
  // Use midnight precision so the value is stable across renders within the same day.
  // new Date() with millisecond precision changes every render → infinite query loop.
  const today = getMidnight();
  if (window === 'overdue') return today;
  if (window === 'this-week') return new Date(today.getTime() + 7 * 86_400_000);
  if (window === 'this-month') return new Date(today.getTime() + 30 * 86_400_000);
  return undefined;
}

const TONE_CLASS = {
  overdue: 'text-red-600 dark:text-red-400 font-medium',
  warning: 'text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
  default: '',
} as const;

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function BillsTable() {
  const router = useRouter();
  const { filters, clearAll } = useBillFilters();

  const { data: rawBills, isLoading } = trpc.bill.list.useQuery({
    status: filters.status ?? undefined,
    dueBefore: dueBeforeFromWindow(filters.due),
    needsMyApproval: filters.mine || undefined,
    search: filters.q || undefined,
  });

  const rawTyped = rawBills as BillWithVendor[] | undefined;
  const bills =
    filters.due === 'overdue' && rawTyped ? filterOverdue(rawTyped) : (rawTyped ?? []);

  function handleRowClick(id: string) {
    router.push(`/bills/${id}`);
  }

  function handleRowKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') router.push(`/bills/${id}`);
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="w-36">Status</TableHead>
            <TableHead scope="col">Vendor</TableHead>
            <TableHead scope="col" className="hidden sm:table-cell">Invoice #</TableHead>
            <TableHead scope="col" className="text-right">Amount</TableHead>
            <TableHead scope="col">Due</TableHead>
            <TableHead scope="col" className="hidden md:table-cell text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : bills.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <p className="text-sm">No bills match these filters.</p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            bills.map((bill) => {
              const { label: dueLabel, tone } = formatRelativeDueDate(
                new Date(bill.dueDate),
                bill.status,
              );
              return (
                <TableRow
                  key={bill.id}
                  tabIndex={0}
                  onClick={() => handleRowClick(bill.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, bill.id)}
                  className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 outline-none"
                >
                  <TableCell className="py-3 px-4">
                    <BillStatusPill status={bill.status} />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="font-medium text-sm leading-tight">
                      {bill.vendor.name}
                    </div>
                    {bill.vendor.email && (
                      <div className="text-xs text-muted-foreground truncate max-w-40">
                        {bill.vendor.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-3 px-4 text-sm text-muted-foreground">
                    {bill.invoiceNumber ?? '—'}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right tabular-nums text-sm font-medium">
                    {formatUSD(bill.amountCents)}
                  </TableCell>
                  <TableCell className={cn('py-3 px-4 text-sm', TONE_CLASS[tone])}>
                    {dueLabel}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3 px-4 text-right text-xs text-muted-foreground">
                    {formatTimeAgo(new Date(bill.updatedAt))}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
