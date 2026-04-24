import { useRouter, useSearchParams } from 'next/navigation';
import type { BillStatus } from '@/generated/prisma/enums';

export type DueWindow = 'overdue' | 'this-week' | 'this-month' | null;

export interface BillFilters {
  status: BillStatus | null;
  due: DueWindow;
  mine: boolean;
  q: string;
}

export function useBillFilters() {
  const params = useSearchParams();
  const router = useRouter();

  const filters: BillFilters = {
    status: (params.get('status') as BillStatus | null) ?? null,
    due: (params.get('due') as DueWindow) ?? null,
    mine: params.get('mine') === '1',
    q: params.get('q') ?? '',
  };

  function setFilter<K extends keyof BillFilters>(key: K, value: BillFilters[K]) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '' || value === false) {
      next.delete(key);
    } else {
      next.set(key, key === 'mine' ? '1' : String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.replace('?', { scroll: false });
  }

  const hasFilters = !!(filters.status || filters.due || filters.mine || filters.q);

  return { filters, setFilter, clearAll, hasFilters };
}
