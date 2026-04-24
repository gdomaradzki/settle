import type { Metadata } from 'next';
import { BillIntakePage } from '@/features/intake/components/bill-intake-page';

export const metadata: Metadata = { title: 'New bill — Settle' };

export default function NewBillPage() {
  return <BillIntakePage />;
}
