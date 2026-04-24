import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerCaller } from '@/server/root-router';
import { BillDetailView } from '@/features/bills/components/bill-detail-view';
import type { BillWithRelations } from '@/features/bills/bill-service';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const caller = await createServerCaller();
    const bill = (await caller.bill.get(id)) as BillWithRelations;
    return { title: `Bill ${bill.invoiceNumber ?? id} — Settle` };
  } catch {
    return { title: 'Bill — Settle' };
  }
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;

  let bill: BillWithRelations;
  try {
    const caller = await createServerCaller();
    bill = (await caller.bill.get(id)) as BillWithRelations;
  } catch {
    notFound();
  }

  return <BillDetailView initialBill={bill} />;
}
