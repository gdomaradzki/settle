import 'server-only';
import { cookies } from 'next/headers';
import { router, createCallerFactory, resolveUser } from './trpc';
import { billRouter } from '@/features/bills/bill-router';
import { userRouter } from '@/features/users/user-router';

export const appRouter = router({
  bill: billRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export async function createServerCaller() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('settle-user-id')?.value;
  const user = await resolveUser(userId);
  return createCallerFactory(appRouter)({ user });
}
