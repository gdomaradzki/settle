import type { Metadata } from "next";
import { CsvUploadPage } from "@/features/intake/components/csv-upload-page";

export const metadata: Metadata = { title: "Upload CSV — Settle" };

export default function UploadCsvPage() {
  return <CsvUploadPage />;
}
