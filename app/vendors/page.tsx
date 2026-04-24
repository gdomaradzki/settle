import type { Metadata } from 'next';
import { createServerCaller } from '@/server/root-router';
import { VendorsTable, type VendorWithOutstanding } from '@/features/vendors/components/vendors-table';

export const metadata: Metadata = { title: 'Vendors — Settle' };

export default async function VendorsPage() {
  const caller = await createServerCaller();
  const vendors = (await caller.vendor.list()) as unknown as VendorWithOutstanding[];

  return <VendorsTable initialVendors={vendors} />;
}
