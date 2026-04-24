import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { BillsFilterSidebar } from '@/features/bills/components/bills-filter-sidebar';
import { BillsSearch } from '@/features/bills/components/bills-search';
import { BillsTable } from '@/features/bills/components/bills-table';

export const metadata: Metadata = { title: 'Bills — Settle' };

export default function BillsPage() {
  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 min-w-0">
      {/* Sidebar — client component needs Suspense for useSearchParams */}
      <Suspense>
        <BillsFilterSidebar />
      </Suspense>

      {/* Main area */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-foreground">Bills</h1>
          <div className="flex items-center gap-2">
            <Suspense>
              <BillsSearch />
            </Suspense>
            <Link
              href="/bills/new"
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 shrink-0"
            >
              <PlusIcon className="size-3.5" />
              New bill
            </Link>
          </div>
        </div>

        <Suspense>
          <BillsTable />
        </Suspense>
      </div>
    </div>
  );
}
