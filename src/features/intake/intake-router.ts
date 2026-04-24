import 'server-only';
import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { extractInvoiceData } from './services/extract-invoice-data';

export const intakeRouter = router({
  extractFromPdf: protectedProcedure
    .input(z.object({ pdfBase64: z.string(), filename: z.string() }))
    .mutation(({ input }) => extractInvoiceData(input.pdfBase64, input.filename)),
});
