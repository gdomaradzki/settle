# Tasks: add-pdf-persistence

## Infrastructure (complete)

- [x] Enable Vercel Blob via the Vercel dashboard → Storage → Create Blob Store → link to Settle project.
- [x] `BLOB_READ_WRITE_TOKEN` auto-populated in Vercel env.
- [x] Sync locally via `vercel env pull .env.development.local`.
- [x] Add `BLOB_READ_WRITE_TOKEN=` placeholder to `.env.example` with comment explaining optional-but-recommended usage.

## Dependencies

- [x] Install `@vercel/blob`.

## Storage service

- [x] Create `src/features/intake/services/store-invoice-pdf.ts`:
  - `import 'server-only';`
  - Exports `storeInvoicePdf(pdfBase64: string, filename: string): Promise<string | null>`.
  - Decodes base64 to Buffer.
  - Calls `put(filename, buffer, { access: 'public', addRandomSuffix: true })`.
  - Returns `blob.url` on success.
  - Try/catch around the entire function body; on any error, log and return `null` — never throw.

## Intake router

- [x] Update `extractFromPdf` in `src/features/intake/intake-router.ts`:
  - Returns `{ extraction, pdfUrl: string | null }`.
  - Uses `Promise.all` to run extraction and blob storage in parallel.

## Intake form and page

- [x] Update the intake components to hold `pdfUrl` in client state after the `extractFromPdf` mutation resolves.
- [x] Include `pdfPath: pdfUrl` in the `bill.create` mutation payload when saving the bill.
- [x] Switch the intake preview iframe from local `URL.createObjectURL(file)` to the persisted `pdfUrl` once available.
- [x] Call `URL.revokeObjectURL` on the stale local URL when switching.

## Schema glue

- [x] Verify `CreateBillInput` in `src/features/bills/schemas.ts` accepts an optional nullable `pdfPath`. Add if missing.
- [x] Verify `bill-service.ts`'s `createBill` passes `pdfPath` through to the Prisma insert.

## README

- [x] Add a short line under architecture notes explaining Blob usage and the graceful-fallback behavior when the token is missing.
- [x] Note the public-URL tradeoff (appropriate for demo; production would use signed URLs).

## Verification

- [x] `npm install @vercel/blob` completes cleanly.
- [x] `.env.development.local` contains a non-empty `BLOB_READ_WRITE_TOKEN` after pulling from Vercel.
- [x] Restart dev server. Upload a real invoice PDF via `/bills/new`.
  - Extraction still works.
  - Intake preview iframe shows the uploaded PDF.
  - Bill saves with `pdfPath` set to a Blob URL matching the pattern `https://<hash>.public.blob.vercel-storage.com/<n>-<random>.pdf`.
- [x] Navigate to the newly-created bill's detail page — the PDF pane renders the uploaded PDF (not a canned sample, not a 404).
- [x] Navigate to a seeded bill's detail page — the PDF still loads from `/public/samples/*.pdf`, unchanged.
- [x] Simulate Blob failure by temporarily setting `BLOB_READ_WRITE_TOKEN` to an invalid value, restarting, and uploading a PDF. Extraction still completes, bill gets created with `pdfPath = null`, detail page shows the no-PDF fallback. Restore the env var after.
- [x] Deploy to Vercel. Walk the full flow on the live URL and confirm persistence.

## Definition of done

- All checkboxes above are ticked.
- Intake preview and detail page both render the same PDF — the uploaded one.
- Graceful degradation preserved when Blob is unconfigured or fails.
- `openspec validate --strict add-pdf-persistence` passes.
