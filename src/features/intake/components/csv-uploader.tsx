"use client";
import { useRef, useState } from "react";
import { UploadCloudIcon, XIcon } from "lucide-react";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

interface Props {
  onParsed: (rows: Record<string, string>[]) => void;
}

export function CsvUploader({ onParsed }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("File must be under 1 MB.");
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      if (result.errors.length > 0) {
        setError(`Parse error: ${result.errors[0].message}`);
        return;
      }
      if (result.data.length === 0) {
        setError("The CSV has no rows.");
        return;
      }
      onParsed(result.data);
    };
    reader.readAsText(file);
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) processFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-14 text-center transition-colors",
          isDragging
            ? "border-foreground/40 bg-muted/60"
            : "border-border bg-muted/20 hover:border-foreground/30 hover:bg-muted/40",
          error && "border-destructive/50",
        )}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />
        <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
          <UploadCloudIcon className="size-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Drop a CSV file here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or{" "}
            <span className="underline underline-offset-2">
              click to browse
            </span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">CSV only · max 1 MB</p>
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
