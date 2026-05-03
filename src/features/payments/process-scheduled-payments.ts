import 'server-only';
import type { CronJob } from '@/server/cron/types';
import { payBill } from '@/features/bills/bill-service';
import { SYSTEM_USER_ID } from '@/features/users/system-user';

export const processScheduledPayments: CronJob = {
  name: 'process-scheduled-payments',
  description:
    'Transitions every SCHEDULED bill whose pay date has arrived to PAID.',
  async run(ctx) {
    const due = await ctx.db.bill.findMany({
      where: { status: 'SCHEDULED', scheduledPayDate: { lte: ctx.now } },
      select: { id: true },
    });

    let processed = 0;
    const errors: Array<{ id?: string; message: string }> = [];

    for (const bill of due) {
      try {
        await payBill(bill.id, SYSTEM_USER_ID);
        processed++;
      } catch (err) {
        errors.push({
          id: bill.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      jobName: 'process-scheduled-payments',
      processed,
      skipped: 0,
      errors,
    };
  },
};
