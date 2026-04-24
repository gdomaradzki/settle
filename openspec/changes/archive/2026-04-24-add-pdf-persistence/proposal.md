# Change: add-pdf-persistence

## Why

Before this change, uploaded invoice PDFs during intake were extracted for structured data and then discarded. `Bill.pdfPath` on intake-created bills was null or mapped to an unrelated canned sample by vendor, producing a visible UX inconsistency: the intake page's preview showed the actual uploaded PDF (via a local `blob:` URL), but the detail page showed either nothing or the wrong file.

This change persists uploaded PDFs to Vercel Blob storage, stores the resulting URL on `Bill.pdfPath`, and flows that same URL through the intake preview. Both screens now render the exact file the user uploaded.

## What Changes

- **ADDED** `@vercel/blob` dependency.
- **ADDED** `src/features/intake/services/store-invoice-pdf.ts` — server-only service that uploads a base64-encoded PDF to Vercel Blob and returns a public URL, or `null` on failure.
- **MODIFIED** `src/features/intake/intake-router.ts` — `extractFromPdf` mutation now returns `{ extraction, pdfUrl }` and calls `storeInvoicePdf` in parallel with extraction.
- **MODIFIED** the intake form and page — hold `pdfUrl` in client state, pass it into `bill.create` so it persists on the Bill row, and use it as the iframe source for the intake preview.
- **ADDED** `BLOB_READ_WRITE_TOKEN` as a documented optional env var in `.env.example`.

The `Bill.pdfPath` column was not changed — it was already a nullable string. Seeded bills still reference paths under `/public/samples/*.pdf`; the detail page's viewer treats Blob URLs and local paths identically.

## Impact

- Intake preview and detail page now show the same PDF — the one the user uploaded.
- Uploaded PDFs persist across sessions, deploys, and cold starts.
- Graceful degradation preserved: if `BLOB_READ_WRITE_TOKEN` is unset or the upload fails, `pdfUrl` is `null`, the bill is created with `pdfPath = null`, and the detail page shows its existing "No PDF attached" fallback. No user-visible errors.
- No schema migration. No new capability. Pure refinement of the intake flow.

## Success criteria

- Uploading an invoice PDF during intake persists it to Vercel Blob.
- The newly-created bill's detail page displays the uploaded PDF (not a canned sample, not a 404).
- Seeded bills (which still reference `/public/samples/*.pdf`) continue to display correctly on the detail page.
- With `BLOB_READ_WRITE_TOKEN` intentionally invalidated, intake still succeeds: extraction completes, bill is created, detail page shows the no-PDF fallback. No crash, no error toast.
- Public Blob URLs include an unguessable random suffix — eyeballing two uploads of the same filename should show two distinct URLs.
