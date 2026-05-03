import 'server-only';
import type { CronJob } from './types';
import { processScheduledPayments } from '@/features/payments/process-scheduled-payments';
import { generateRecurringBills } from '@/features/templates/generate-recurring-bills';

// Downstream feature changes append exactly one entry here each.
export const cronRegistry: CronJob[] = [
  processScheduledPayments,
  generateRecurringBills,
];
