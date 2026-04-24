import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon, UploadIcon } from "lucide-react";
import { BillsFilterSidebar } from "@/features/bills/components/bills-filter-sidebar";
import { BillsMobileFiltersSheet } from "@/features/bills/components/bills-mobile-filters-sheet";
import { BillsSearch } from "@/features/bills/components/bills-search";
import { BillsTable } from "@/features/bills/components/bills-table";

export const metadata: Metadata = { title: "Bills — Settle" };

export default function BillsPage() {
  return (
    <div className="flex h-full min-h-0 min-w-0">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border overflow-y-auto">
        <Suspense>
          <BillsFilterSidebar />
        </Suspense>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-6 py-5">
        {/* Toolbar — wraps on narrow viewports */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-semibold text-foreground mr-auto">
            Bills
          </h1>
          {/* Mobile: Filters sheet trigger (md:hidden inside component) */}
          <Suspense>
            <BillsMobileFiltersSheet />
          </Suspense>
          {/* Search */}
          <Suspense>
            <BillsSearch />
          </Suspense>
          <Link
            href="/bills/upload-csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted shrink-0">
            <UploadIcon className="size-3.5" />
            Upload CSV
          </Link>
          <Link
            href="/bills/new"
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 shrink-0">
            <PlusIcon className="size-3.5" />
            New bill
          </Link>
        </div>

        <Suspense>
          <BillsTable />
        </Suspense>
      </div>
    </div>
  );
}
