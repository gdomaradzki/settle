This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Architecture notes

### PDF persistence (Vercel Blob)

Uploaded invoice PDFs are stored in Vercel Blob (`@vercel/blob`). The `BLOB_READ_WRITE_TOKEN` env var is required; if unset or if the upload fails, `Bill.pdfPath` is left `null` and the detail page renders its "No PDF attached" fallback — the bill is still created normally. This failure path is intentional: the demo never breaks because of a missing or misconfigured token.

Blobs are written with `access: 'public'` and `addRandomSuffix: true` — URLs are unguessable but not access-controlled. This is appropriate for demo data; a production deployment would switch to private blobs with server-minted signed URLs to prevent accidental disclosure via referer logs or URL sharing.

The intake preview iframe switches from a local `blob:` URL (shown immediately on file selection) to the persisted Blob URL once `extractFromPdf` returns. The local URL is revoked at that point to free browser memory.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
