import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SummaryTile } from '@/features/dashboard/components/summary-tile';
import { formatUSD } from '@/lib/money';
import { formatAbsoluteDate } from '@/lib/dates';
import { AgingBucketPill } from './aging-bucket-pill';
import type { ApAgingReport as ReportData, BucketKey, VendorRow } from '../report-service';

function billsLabel(n: number) {
  return n === 1 ? '1 bill' : `${n} bills`;
}

function Cell({ cents, bucket }: { cents: number; bucket: BucketKey }) {
  if (cents === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return <AgingBucketPill bucket={bucket} value={formatUSD(cents)} />;
}

function rowTotal(row: VendorRow) {
  return row.current + row.d1to30 + row.d31to60 + row.d61plus;
}

interface Props {
  data: ReportData;
}

export function ApAgingReport({ data }: Props) {
  const grandTotal =
    data.totals.current + data.totals.d1to30 + data.totals.d31to60 + data.totals.d61plus;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">AP Aging Report</h1>
        <p className="text-sm text-muted-foreground">
          as of {formatAbsoluteDate(data.asOf)}
        </p>
      </div>

      {/* Summary tiles — four buckets */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile
          title="Current"
          value={formatUSD(data.totals.current)}
          hint={billsLabel(data.billCount.current)}
        />
        <SummaryTile
          title="1–30 days"
          value={formatUSD(data.totals.d1to30)}
          hint={billsLabel(data.billCount.d1to30)}
        />
        <SummaryTile
          title="31–60 days"
          value={formatUSD(data.totals.d31to60)}
          hint={billsLabel(data.billCount.d31to60)}
        />
        <SummaryTile
          title="61+ days"
          value={formatUSD(data.totals.d61plus)}
          hint={billsLabel(data.billCount.d61plus)}
        />
      </div>

      {/* Vendor table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="min-w-40">Vendor</TableHead>
              <TableHead scope="col" className="text-right">Current</TableHead>
              <TableHead scope="col" className="text-right">1–30</TableHead>
              <TableHead scope="col" className="text-right">31–60</TableHead>
              <TableHead scope="col" className="text-right">61+</TableHead>
              <TableHead scope="col" className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.vendorRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No outstanding bills
                </TableCell>
              </TableRow>
            ) : (
              data.vendorRows.map((row) => (
                <TableRow key={row.vendorId}>
                  <TableCell className="py-3 font-medium">{row.vendorName}</TableCell>
                  <TableCell className="py-3 text-right">
                    <Cell cents={row.current} bucket="current" />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Cell cents={row.d1to30} bucket="d1to30" />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Cell cents={row.d31to60} bucket="d31to60" />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Cell cents={row.d61plus} bucket="d61plus" />
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums font-medium">
                    {formatUSD(rowTotal(row))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="py-3 font-semibold">Total</TableCell>
              <TableCell className="py-3 text-right">
                <AgingBucketPill bucket="current" value={formatUSD(data.totals.current)} />
              </TableCell>
              <TableCell className="py-3 text-right">
                <AgingBucketPill bucket="d1to30" value={formatUSD(data.totals.d1to30)} />
              </TableCell>
              <TableCell className="py-3 text-right">
                <AgingBucketPill bucket="d31to60" value={formatUSD(data.totals.d31to60)} />
              </TableCell>
              <TableCell className="py-3 text-right">
                <AgingBucketPill bucket="d61plus" value={formatUSD(data.totals.d61plus)} />
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums font-semibold">
                {formatUSD(grandTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
