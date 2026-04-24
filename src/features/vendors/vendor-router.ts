import 'server-only';
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { db } from '@/server/db';

export const vendorRouter = router({
  list: publicProcedure.query(() =>
    db.vendor.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        paymentMethod: true,
        defaultGlCategory: true,
      },
    }),
  ),

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
