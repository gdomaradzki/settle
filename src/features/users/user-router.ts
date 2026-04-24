import 'server-only';
import { router, publicProcedure } from '@/server/trpc';
import { db } from '@/server/db';

export const userRouter = router({
  list: publicProcedure.query(() =>
    db.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    }),
  ),

  current: publicProcedure.query(({ ctx }) => ctx.user),
});
