"use client";
import { Suspense } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBillFilters } from "../hooks/use-bill-filters";
import { BillsFilterSidebar } from "./bills-filter-sidebar";

export function BillsMobileFiltersSheet() {
  const { filters } = useBillFilters();
  const activeCount = [
    filters.status,
    filters.due,
    filters.mine,
    filters.q,
    filters.vendor,
  ].filter(Boolean).length;

  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 md:hidden",
        )}>
        <SlidersHorizontalIcon className="size-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
            {activeCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
        <Suspense>
          <BillsFilterSidebar />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
