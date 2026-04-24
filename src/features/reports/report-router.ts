import 'server-only';
import { router, publicProcedure } from '@/server/trpc';
import { getApAgingReport } from './report-service';

export const reportRouter = router({
  apAging: publicProcedure.query(() => getApAgingReport()),
});
