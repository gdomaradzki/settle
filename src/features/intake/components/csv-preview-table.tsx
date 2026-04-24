'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatUSD } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { parseCsvRow, type ParsedRow } from '../schemas';
import type { CreateBillInput } from '@/features/bills/schemas';

interface Props {
  rawRows: Record<string, string>[];
  vendors: { id: string; name: string }[];
  onConfirm: (valid: CreateBillInput[]) => void;
  onReset: () => void;
  isSubmitting: boolean;
}

function downloadErrorsCsv(rows: ParsedRow[]) {
  const invalid = rows.filter((r) => r.status === 'invalid');
  const headers = Object.keys(invalid[0]?.raw ?? {}).join(',');
  const lines = invalid.map((r) => {
    const values = Object.values(r.raw).map((v) => `"${v.replace(/"/g, '""')}"`).join(',');
    return `${values},"${r.errors.join('; ')}"`;
  });
  const csv = [headers + ',errors', ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invalid-rows.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvPreviewTable({ rawRows, vendors, onConfirm, onReset, isSubmitting }: Props) {
  const rows = useMemo(
    () => rawRows.map((r) => parseCsvRow(r, vendors)),
    [rawRows, vendors],
  );

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const validInputs = rows.filter((r) => r.status === 'valid' && r.resolved).map((r) => r.resolved!);
  const allValid = invalidCount === 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-emerald-600">{validCount} valid</span>
          {' · '}
          <span className={cn('font-medium', invalidCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {invalidCount} invalid
          </span>
        </p>
        <div className="flex items-center gap-3">
          {invalidCount > 0 && (
            <button
              type="button"
              onClick={() => downloadErrorsCsv(rows)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Download errors
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Replace CSV
          </button>
        </div>
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Vendor</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice #</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Due</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Line</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border last:border-0',
                  row.status === 'invalid' && 'bg-red-50 dark:bg-red-950/20',
                )}
              >
                <td className="px-3 py-2.5">
                  {row.status === 'valid' ? (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      Invalid
                    </span>
                  )}
                </td>
                <td className={cn('px-3 py-2.5', row.status === 'invalid' && !row.resolved && 'text-red-600')}>
                  {row.raw.vendor_name || '—'}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.raw.invoice_number || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.resolved ? formatUSD(row.resolved.amountCents) : (row.raw.amount || '—')}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.raw.due_date || '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground truncate max-w-32">{row.raw.line_description || '—'}</td>
                <td className="px-3 py-2.5">
                  {row.errors.length > 0 && (
                    <ul className="space-y-0.5">
                      {row.errors.map((e, j) => (
                        <li key={j} className="text-xs text-red-600 dark:text-red-400">{e}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm button */}
      <div className="flex justify-end">
        <Button
          disabled={!allValid || isSubmitting || validInputs.length === 0}
          onClick={() => onConfirm(validInputs)}
        >
          {isSubmitting ? 'Importing…' : `Import ${validCount} bill${validCount !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
