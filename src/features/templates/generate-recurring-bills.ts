import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import {
  createScheduledBillFromTemplate,
  type TemplateWithVendorAndLineItems,
} from "@/features/bills/bill-service";
import type { CronJob, CronContext, JobResult } from "@/server/cron/types";
import { LEAD_DAYS_BY_METHOD, addUtcDays } from "./lead-time";

async function run(ctx: CronContext): Promise<JobResult> {
  let processed = 0;
  let skipped = 0;
  const errors: Array<{ id?: string; message: string }> = [];

  for (const [method, leadDays] of Object.entries(LEAD_DAYS_BY_METHOD) as Array<
    [PaymentMethod, number]
  >) {
    const targetPayDate = addUtcDays(ctx.now, leadDays);
    const targetDay = targetPayDate.getUTCDate();

    // paymentDayOfMonth is constrained to 1–28 at the input layer; targetDay
    // outside that range can never match, so skip the query.
    if (targetDay > 28) continue;

    const templates = await ctx.db.billTemplate.findMany({
      where: {
        cancelledAt: null,
        paymentDayOfMonth: targetDay,
        vendor: { paymentMethod: method },
      },
      include: { vendor: true, lineItems: true },
    });

    for (const template of templates) {
      try {
        await createScheduledBillFromTemplate(
          template as unknown as TemplateWithVendorAndLineItems,
          targetPayDate,
          template.createdById,
        );
        processed++;
      } catch (e) {
        const isUniqueViolation =
          (e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002") ||
          (e instanceof Error && e.message.includes("Unique constraint failed"));
        if (isUniqueViolation) {
          skipped++;
        } else {
          errors.push({
            id: template.id,
            message:
              e instanceof Error
                ? e.message
                : `Unknown error for template ${template.id}`,
          });
        }
      }
    }
  }

  return {
    jobName: "generate-recurring-bills",
    processed,
    skipped,
    errors,
  };
}

export const generateRecurringBills: CronJob = {
  name: "generate-recurring-bills",
  description:
    "Creates a SCHEDULED bill instance for each active BillTemplate whose paymentDayOfMonth matches today + the vendor's payment-method lead time (10d ACH, 15d check).",
  run,
};
