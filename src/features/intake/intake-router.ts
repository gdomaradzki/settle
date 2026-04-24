import 'server-only';
import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { extractInvoiceData } from './services/extract-invoice-data';
import { storeInvoicePdf } from './services/store-invoice-pdf';

export const intakeRouter = router({
  extractFromPdf: protectedProcedure
    .input(z.object({ pdfBase64: z.string(), filename: z.string() }))
    .mutation(async ({ input }) => {
      const [extraction, pdfUrl] = await Promise.all([
        extractInvoiceData(input.pdfBase64, input.filename),
        storeInvoicePdf(input.pdfBase64, input.filename),
      ]);
      return { extraction, pdfUrl };
    }),
});
