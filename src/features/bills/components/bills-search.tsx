'use client';
import { useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useBillFilters } from '../hooks/use-bill-filters';

export function BillsSearch() {
  const { filters, setFilter } = useBillFilters();
  const [draft, setDraft] = useState(filters.q);
  const debounced = useDebounce(draft, 200);

  useEffect(() => {
    setFilter('q', debounced);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Sync if URL param changes externally (e.g. clearAll)
  useEffect(() => {
    setDraft(filters.q);
  }, [filters.q]);

  return (
    <div className="relative">
      <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        aria-label="Search bills"
        placeholder="Search by vendor or invoice number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="pl-8 h-8 text-sm w-64"
      />
    </div>
  );
}
