'use client';
import { useState } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBillFilters, type DueWindow } from '../hooks/use-bill-filters';
import type { BillStatus } from '@/generated/prisma/enums';

const STATUSES: { value: BillStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
];

const DUE_WINDOWS: { value: DueWindow; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this-week', label: 'Due this week' },
  { value: 'this-month', label: 'Due this month' },
];

function RadioItem({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-0.5 group">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="accent-foreground size-3.5"
      />
      <span
        className={cn(
          'text-sm transition-colors',
          checked
            ? 'text-foreground font-medium'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        {label}
      </span>
    </label>
  );
}

export function BillsFilterSidebar() {
  const { filters, setFilter, clearAll, hasFilters } = useBillFilters();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = [filters.status, filters.due, filters.mine, filters.q].filter(Boolean).length;

  const filterContent = (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Status
        </legend>
        <RadioItem
          checked={filters.status === null}
          label="Any"
          onChange={() => setFilter('status', null)}
        />
        {STATUSES.map(({ value, label }) => (
          <RadioItem
            key={value}
            checked={filters.status === value}
            label={label}
            onChange={() => setFilter('status', value)}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Due
        </legend>
        {DUE_WINDOWS.map(({ value, label }) => (
          <RadioItem
            key={label}
            checked={filters.due === value}
            label={label}
            onChange={() => setFilter('due', value)}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Quick filters
        </legend>
        <label className="flex items-center gap-2 cursor-pointer py-0.5 group">
          <input
            type="checkbox"
            checked={filters.mine}
            onChange={(e) => setFilter('mine', e.target.checked)}
            className="accent-foreground size-3.5"
          />
          <span
            className={cn(
              'text-sm transition-colors',
              filters.mine
                ? 'text-foreground font-medium'
                : 'text-muted-foreground group-hover:text-foreground',
            )}
          >
            Needs my approval
          </span>
        </label>
      </fieldset>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-auto text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile toggle button — hidden on md+ */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontalIcon className="size-3.5" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile panel — animated via grid-rows collapse */}
      <div
        className={cn(
          'grid md:hidden transition-[grid-template-rows] duration-200 ease-in-out border-b border-border',
          mobileOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 pl-4 pr-5 py-5">{filterContent}</div>
        </div>
      </div>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-5 border-r border-border pl-4 pr-5 py-5">
        {filterContent}
      </aside>
    </>
  );
}
