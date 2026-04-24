'use client';
import { useRef, useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { PdfUploader } from './pdf-uploader';
import { BillIntakeForm } from './bill-intake-form';
import type { InvoiceExtraction } from '../schemas';

type Mode = 'choose' | 'form';

export function BillIntakePage() {
  const [mode, setMode] = useState<Mode>('choose');
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  // Track the local blob: URL so we can revoke it when the persisted Blob URL arrives
  const localUrlRef = useRef<string | null>(null);

  function handleFileSelected(localUrl: string) {
    localUrlRef.current = localUrl;
    setPreviewUrl(localUrl);
    setIsExtracting(true);
    setMode('form');
  }

  function handleExtracted(
    data: InvoiceExtraction,
    _filename: string,
    blobUrl: string | null,
  ) {
    setExtraction(data);
    setPdfUrl(blobUrl);
    setIsExtracting(false);
    if (blobUrl && localUrlRef.current) {
      // Switch preview from ephemeral blob: URL to the persisted Blob URL, free memory
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
      setPreviewUrl(blobUrl);
    }
  }

  function handleReset() {
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
    setMode('choose');
    setExtraction(null);
    setPreviewUrl(null);
    setPdfUrl(null);
    setIsExtracting(false);
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
          <PdfUploader
            onFileSelected={handleFileSelected}
            onExtracted={handleExtracted}
          />

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
        <div className="space-y-5">
          {/* PDF preview — uses local blob: URL until Blob URL arrives, then switches */}
          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-border">
              <iframe
                src={previewUrl}
                title="Invoice preview"
                className="h-52 w-full border-0"
              />
            </div>
          )}

          {isExtracting ? (
            <div className="space-y-4" aria-label="Extracting invoice data…">
              {[100, 80, 96, 80, 96].map((w, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div
                    className="h-8 animate-pulse rounded-md bg-muted"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
              <div className="h-px w-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Extracting invoice data…
              </p>
            </div>
          ) : (
            <BillIntakeForm
              initialExtraction={extraction}
              pdfUrl={pdfUrl}
              onReset={handleReset}
            />
          )}
        </div>
      )}
    </div>
  );
}
