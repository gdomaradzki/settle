'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, FileSpreadsheetIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc-client';
import { CsvUploader } from './csv-uploader';
import { CsvPreviewTable } from './csv-preview-table';
import type { CreateBillInput } from '@/features/bills/schemas';

type Mode = 'idle' | 'preview';

export function CsvUploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  const { data: vendors } = trpc.vendor.list.useQuery();
  const utils = trpc.useUtils();

  const createMany = trpc.bill.createMany.useMutation({
    onSuccess: (result) => {
      utils.bill.list.invalidate();
      toast.success(`${result.created} bill${result.created !== 1 ? 's' : ''} imported`);
      router.push('/bills');
    },
    onError: (err) => toast.error(err.message),
  });

  function handleParsed(rows: Record<string, string>[]) {
    setRawRows(rows);
    setMode('preview');
  }

  function handleConfirm(valid: CreateBillInput[]) {
    createMany.mutate(valid);
  }

  function handleReset() {
    setMode('idle');
    setRawRows([]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/bills"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Bills
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Bulk upload</h1>
      </div>

      {mode === 'idle' ? (
        <div className="space-y-6">
          <CsvUploader onParsed={handleParsed} />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheetIcon className="size-4 shrink-0" />
            <span>Need a template?</span>
            <a
              href="/samples/bills-sample.csv"
              download
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Download bills-sample.csv
            </a>
          </div>
        </div>
      ) : (
        <CsvPreviewTable
          rawRows={rawRows}
          vendors={vendors ?? []}
          onConfirm={handleConfirm}
          onReset={handleReset}
          isSubmitting={createMany.isPending}
        />
      )}
    </div>
  );
}
