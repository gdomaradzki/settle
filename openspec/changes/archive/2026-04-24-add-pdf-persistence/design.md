# Design: add-pdf-persistence

## Why Vercel Blob

The app deploys to Vercel. Blob is the native object-storage primitive, installable via Marketplace like Neon was for Postgres. Hobby tier includes 1GB free storage — ample for demo scale, and access is hard-capped rather than billed, so no surprise cost on overage.

Alternatives considered and rejected:

- **Supabase Storage** — we already rejected Supabase for the DB due to inactivity-pause behavior. Adding it just for Blob would reintroduce the dependency we avoided.
- **Cloudflare R2** — more generous free tier (10GB), but requires a separate account, dashboard, and API tokens. Adds ~30 minutes of setup vs. Blob's "enable in Vercel dashboard, env var auto-populated" path.
- **Base64 into Postgres** — works, but bloats rows with binary-in-text, slows list queries, awkward to serve to the browser. Not chosen.
- **Local filesystem under `/uploads`** — doesn't work on Vercel at all; serverless filesystem is ephemeral.

## Public access with random suffix

Blobs are written with `{ access: 'public', addRandomSuffix: true }`:

- **Public** is required because the detail page renders the PDF in a plain `<iframe src={pdfPath}>`. Private blobs would need server-minted signed URLs refreshed per render — about 2 hours of code to achieve the same visual result.
- **Random suffix** prevents URL guessing. `aws-invoice-Kj8mQ2p7.pdf` is not enumerable.

This is the same security model as unlisted YouTube videos: public, unguessable. Appropriate for a demo where there's no real multi-tenancy or regulated data. A production AP product would switch to private blobs + signed URLs to prevent accidental disclosure through referer logs or URL sharing. This tradeoff is called out in the README.

## The failure contract

`storeInvoicePdf` catches all errors internally and returns `null` on failure. It never throws. Callers treat `null` as "no persistence happened" — identical to the pre-existing no-upload path. This preserves two important properties:

1. **The demo never breaks because Blob is misconfigured.** If a deployer forgets the token or hits the quota, bills still get created; they just lack PDFs.
2. **The intake flow's happy path is unchanged in its shape.** Existing code treats `pdfPath: null` correctly already; this change doesn't introduce new failure modes, it just adds a non-null value to an existing nullable field.

## Parallel execution

`extractFromPdf` runs extraction and blob storage in parallel via `Promise.all`:

```ts
const [extraction, pdfUrl] = await Promise.all([
  extractInvoiceData(input.pdfBase64, input.filename),
  storeInvoicePdf(input.pdfBase64, input.filename),
]);
```

Extraction takes ~3 seconds (Claude API round-trip); blob upload is typically <500ms. Running them sequentially would add the blob latency to the user's perceived wait; running in parallel hides it entirely.

If either fails, the other still proceeds — and the caller handles both outcomes independently (extraction returning defaults, blob returning null).

## Intake preview now uses the persisted URL

Before this change, the intake preview iframe used `URL.createObjectURL(file)` — a local `blob:` URL that exists only in the tab's memory. After this change, once `extractFromPdf` returns `pdfUrl`, the preview iframe switches to that URL. Benefits:

- Preview and detail page render from the same source.
- If the user closes the tab mid-flow and reopens, the URL still works (the blob is persisted, not tied to tab memory).
- `URL.revokeObjectURL` of the local blob URL is called when switching, to free memory.

## Seeded bills unchanged

`prisma/seed.ts` still sets `pdfPath` to paths like `/samples/aws-invoice.pdf` for seeded bills. The detail page's `<BillPdfViewer>` treats any non-null `pdfPath` as an iframe `src` — whether that's a Blob URL or a local path doesn't matter to the browser. No migration needed; the column's semantics didn't change.

## What this change does not do

- No cleanup of orphaned blobs when a bill is deleted. Blobs leak if a bill is deleted — acceptable for MVP since there's no delete UI.
- No server-side file-type validation. The client caps at 10MB and accepts `application/pdf`, but nothing stops a malicious client from POSTing a non-PDF payload. For a demo this is fine.
- No signed URLs or access control. Anyone with the URL can read the PDF.
- No bulk upload. One PDF per bill, via intake only.
