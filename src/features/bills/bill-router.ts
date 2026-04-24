import 'server-only';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { InvalidTransitionError, UnauthorizedError } from './errors';
import {
  createBillInput,
  updateBillInput,
  rejectInput,
  scheduleInput,
  listBillsInput,
} from './schemas';
import * as svc from './bill-service';

function mapError(e: unknown): never {
  if (e instanceof UnauthorizedError) {
    throw new TRPCError({ code: 'FORBIDDEN', message: e.message });
  }
  if (e instanceof InvalidTransitionError) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
  }
  throw e;
}

export const billRouter = router({
  list: publicProcedure
    .input(listBillsInput)
    .query(({ input, ctx }) => svc.listBills(input, ctx.user.id)),

  get: publicProcedure
    .input(z.string())
    .query(({ input }) => svc.getBill(input)),

  create: protectedProcedure
    .input(createBillInput)
    .mutation(({ input, ctx }) => svc.createBill(input, ctx.user.id).catch(mapError)),

  update: protectedProcedure
    .input(updateBillInput)
    .mutation(({ input, ctx }) => svc.updateBill(input, ctx.user.id).catch(mapError)),

  submit: protectedProcedure
    .input(z.string())
    .mutation(({ input, ctx }) => svc.submitBill(input, ctx.user.id).catch(mapError)),

  approve: protectedProcedure
    .input(z.string())
    .mutation(({ input, ctx }) => svc.approveBill(input, ctx.user.id).catch(mapError)),

  reject: protectedProcedure
    .input(rejectInput)
    .mutation(({ input, ctx }) => svc.rejectBill(input.billId, ctx.user.id, input.reason).catch(mapError)),

  schedule: protectedProcedure
    .input(scheduleInput)
    .mutation(({ input, ctx }) =>
      svc.scheduleBill(input.billId, ctx.user.id, input.payDate, input.method).catch(mapError),
    ),

  pay: protectedProcedure
    .input(z.string())
    .mutation(({ input, ctx }) => svc.payBill(input, ctx.user.id).catch(mapError)),
});
