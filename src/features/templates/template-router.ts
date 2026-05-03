import "server-only";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { createTemplateInput, updateTemplateInput } from "./schemas";
import { DuplicateTemplateInstanceError } from "./template-service";
import * as svc from "./template-service";

function mapDuplicateError(e: unknown): never {
  if (e instanceof DuplicateTemplateInstanceError) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "An instance for this template and due date already exists.",
    });
  }
  throw e;
}

export const templateRouter = router({
  list: publicProcedure.query(() => svc.listTemplates()),

  get: publicProcedure
    .input(z.string())
    .query(({ input }) => svc.getTemplate(input)),

  create: protectedProcedure
    .input(createTemplateInput)
    .mutation(({ input, ctx }) => svc.createTemplate(input, ctx.user.id)),

  update: protectedProcedure
    .input(updateTemplateInput)
    .mutation(({ input }) => svc.updateTemplate(input)),

  cancel: protectedProcedure
    .input(z.string())
    .mutation(({ input }) => svc.cancelTemplate(input)),

  runGenerationForOne: protectedProcedure
    .input(z.string())
    .mutation(({ input, ctx }) =>
      svc.runGenerationForTemplate(input, ctx.user.id).catch(mapDuplicateError),
    ),
});
