import { FileXIcon } from 'lucide-react';

interface Props {
  pdfPath: string | null;
  invoiceNumber: string | null;
  id: string;
}

export function BillPdfViewer({ pdfPath, invoiceNumber, id }: Props) {
  if (!pdfPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground">
        <FileXIcon className="size-8 opacity-40" />
        <p className="text-sm">No PDF attached</p>
      </div>
    );
  }

  return (
    <iframe
      src={pdfPath}
      title={`Invoice ${invoiceNumber ?? id}`}
      className="h-full w-full rounded-lg border border-border"
    />
  );
}
