import 'server-only';
import { router, publicProcedure } from '@/server/trpc';
import { getDashboardSummary } from './dashboard-service';

export const dashboardRouter = router({
  summary: publicProcedure.query(({ ctx }) =>
    getDashboardSummary(ctx.user.id, ctx.user.role),
  ),
});
