'use client';
import { useRef, useState } from 'react';
import { UploadCloudIcon, FileTextIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';
import type { InvoiceExtraction } from '../schemas';

interface Props {
  onExtracted: (extraction: InvoiceExtraction, filename: string) => void;
}

export function PdfUploader({ onExtracted }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extract = trpc.intake.extractFromPdf.useMutation({
    onSuccess: (data, vars) => onExtracted(data, vars.filename),
    onError: (err) => {
      setError(err.message);
      toast.error('Extraction failed: ' + err.message);
    },
  });

  async function processFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF is too large. Please upload a file under 10 MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      extract.mutate({ pdfBase64: base64, filename: file.name });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-4',
          'rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors',
          isDragging
            ? 'border-foreground/40 bg-muted/60'
            : 'border-border bg-muted/20 hover:border-foreground/30 hover:bg-muted/40',
          error && 'border-destructive/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
        />

        {extract.isPending ? (
          <>
            <div className="size-12 animate-spin rounded-full border-2 border-border border-t-foreground" />
            <p className="text-sm font-medium text-foreground">Extracting invoice data…</p>
            <p className="text-xs text-muted-foreground">This takes a few seconds</p>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-xl bg-background shadow-sm border border-border">
              <UploadCloudIcon className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Drop invoice PDF here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or <span className="underline underline-offset-2">click to browse</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">PDF only · max 10 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <p className="flex-1 text-xs text-destructive">{error}</p>
          <button type="button" onClick={() => setError(null)}>
            <XIcon className="size-3.5 text-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}
