import 'server-only';
import { router } from './trpc';
import { billRouter } from '@/features/bills/bill-router';
import { userRouter } from '@/features/users/user-router';

export const appRouter = router({
  bill: billRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
