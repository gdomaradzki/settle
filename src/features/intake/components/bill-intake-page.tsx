'use client';
import { useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { PdfUploader } from './pdf-uploader';
import { BillIntakeForm } from './bill-intake-form';
import type { InvoiceExtraction } from '../schemas';

type Mode = 'choose' | 'form';

export function BillIntakePage() {
  const [mode, setMode] = useState<Mode>('choose');
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  function handleExtracted(data: InvoiceExtraction, file: string) {
    setExtraction(data);
    setFilename(file);
    setMode('form');
  }

  function handleReset() {
    setMode('choose');
    setExtraction(null);
    setFilename(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/bills"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Bills
        </Link>
        <h1 className="text-lg font-semibold text-foreground">New bill</h1>
      </div>

      {mode === 'choose' ? (
        <div className="space-y-6">
          <PdfUploader onExtracted={handleExtracted} />

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode('form')}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Enter manually
            </button>
          </div>
        </div>
      ) : (
        <BillIntakeForm
          initialExtraction={extraction}
          uploadedFilename={filename}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
