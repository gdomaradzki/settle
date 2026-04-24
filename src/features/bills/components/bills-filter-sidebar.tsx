'use client';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc-client';
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
  const { data: vendors } = trpc.vendor.list.useQuery();

  return (
    <div className="flex flex-col gap-5 pl-4 pr-5 py-5">
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

      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Vendor
        </legend>
        <select
          value={filters.vendor ?? ''}
          onChange={(e) => setFilter('vendor', e.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none"
        >
          <option value="">Any vendor</option>
          {vendors?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
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
    </div>
  );
}
