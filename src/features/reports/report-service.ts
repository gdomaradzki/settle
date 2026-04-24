import 'server-only';
import { db } from '@/server/db';

export type BucketKey = 'current' | 'd1to30' | 'd31to60' | 'd61plus';

export type VendorRow = {
  vendorId: string;
  vendorName: string;
  current: number;
  d1to30: number;
  d31to60: number;
  d61plus: number;
};

export type ApAgingReport = {
  asOf: Date;
  vendorRows: VendorRow[];
  totals: { current: number; d1to30: number; d31to60: number; d61plus: number };
  billCount: { current: number; d1to30: number; d31to60: number; d61plus: number };
};

type BillWithVendor = {
  vendorId: string;
  amountCents: number;
  dueDate: Date;
  vendor: { id: string; name: string };
};

function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function classifyAge(dueDate: Date, today: Date): BucketKey {
  const due = startOfDayUTC(dueDate);
  const daysOverdue = Math.round((today.getTime() - due.getTime()) / 86_400_000);
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd1to30';
  if (daysOverdue <= 60) return 'd31to60';
  return 'd61plus';
}

export async function getApAgingReport(): Promise<ApAgingReport> {
  const asOf = new Date();
  const today = startOfDayUTC(asOf);

  const rawBills = await db.bill.findMany({
    where: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] } },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { vendor: { name: 'asc' } },
  });

  const bills = rawBills as unknown as BillWithVendor[];

  const byVendor = new Map<string, VendorRow>();
  const totals = { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 };
  const billCount = { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 };

  for (const bill of bills) {
    const bucket = classifyAge(bill.dueDate, today);
    const row: VendorRow = byVendor.get(bill.vendorId) ?? {
      vendorId: bill.vendorId,
      vendorName: bill.vendor.name,
      current: 0,
      d1to30: 0,
      d31to60: 0,
      d61plus: 0,
    };
    row[bucket] += bill.amountCents;
    byVendor.set(bill.vendorId, row);
    totals[bucket] += bill.amountCents;
    billCount[bucket] += 1;
  }

  return {
    asOf,
    vendorRows: [...byVendor.values()],
    totals,
    billCount,
  };
}
