import 'server-only';
import { router } from './trpc';
import { billRouter } from '@/features/bills/bill-router';

export const appRouter = router({
  bill: billRouter,
});

export type AppRouter = typeof appRouter;
