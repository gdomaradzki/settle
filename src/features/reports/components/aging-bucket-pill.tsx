import { cn } from '@/lib/utils';
import type { BucketKey } from '../report-service';

const CLASSES: Record<BucketKey, string> = {
  current: 'text-foreground',
  d1to30: 'text-amber-700 dark:text-amber-400',
  d31to60: 'text-orange-700 dark:text-orange-400',
  d61plus: 'text-red-700 font-semibold dark:text-red-400',
};

interface Props {
  bucket: BucketKey;
  value: string | number;
}

export function AgingBucketPill({ bucket, value }: Props) {
  return (
    <span className={cn('tabular-nums', CLASSES[bucket])}>
      {value}
    </span>
  );
}
