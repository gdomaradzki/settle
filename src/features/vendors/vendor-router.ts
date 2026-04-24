import 'server-only';
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { db } from '@/server/db';

export const vendorRouter = router({
  list: publicProcedure.query(async () => {
    const vendors = await db.vendor.findMany({
      orderBy: { name: 'asc' },
      include: {
        bills: {
          where: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] } },
          select: { amountCents: true },
        },
      },
    });

    type RawVendor = (typeof vendors)[number];
    return (vendors as RawVendor[]).map((v) => ({
      id: v.id,
      name: v.name,
      email: v.email,
      paymentMethod: v.paymentMethod,
      achAccountLast4: v.achAccountLast4,
      achRoutingLast4: v.achRoutingLast4,
      mailingAddress: v.mailingAddress,
      defaultGlCategory: v.defaultGlCategory,
      createdAt: v.createdAt,
      outstandingCount: (v.bills as { amountCents: number }[]).length,
      outstandingCents: (v.bills as { amountCents: number }[]).reduce(
        (s, b) => s + b.amountCents,
        0,
      ),
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal('')),
        paymentMethod: z.enum(['ACH', 'CHECK']),
      }),
    )
    .mutation(({ input }) =>
      db.vendor.create({
        data: {
          name: input.name,
          email: input.email || null,
          paymentMethod: input.paymentMethod,
        },
      }),
    ),
});
