import type { Metadata } from 'next';
import { createServerCaller } from '@/server/root-router';
import { ApAgingReport } from '@/features/reports/components/ap-aging-report';
import type { ApAgingReport as ReportData } from '@/features/reports/report-service';

export const metadata: Metadata = { title: 'AP Aging Report — Settle' };

export default async function ApAgingPage() {
  const caller = await createServerCaller();
  const data = (await caller.reports.apAging()) as unknown as ReportData;

  return <ApAgingReport data={data} />;
}
