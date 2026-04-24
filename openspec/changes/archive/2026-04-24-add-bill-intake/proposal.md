# Change: add-bill-intake

## Why

Right now bills only enter the system via the seed script. The demo walkthrough starts mid-stream: "here's a bill that already exists." Bill intake is what every evaluator expects to see first in an AP product — upload an invoice, watch the system extract fields, confirm, submit. This change makes that flow real.

Two intake paths ship in this change:

1. **PDF upload with LLM extraction.** Upload an invoice, Claude extracts fields, the form prefills, user reviews and saves as DRAFT or submits directly.
2. **Manual entry.** Skip the upload, fill out the form by hand.

CSV bulk upload is a separate change (lowest priority, cut first if time runs short).

## What changes

- **ADDED** `src/app/bills/new/page.tsx` — the intake route, renders the upload + form surface.
- **ADDED** `src/features/intake/components/bill-intake-page.tsx` — client component orchestrating the two paths (upload-driven and manual).
- **ADDED** `src/features/intake/components/pdf-uploader.tsx` — drag-and-drop or click-to-upload zone, posts the file to the extraction endpoint.
- **ADDED** `src/features/intake/components/bill-intake-form.tsx` — the form itself, bound to react-hook-form + zod, with support for add/remove line items and Expense/Item classification per line.
- **ADDED** `src/features/intake/services/extract-invoice-data.ts` — server-only extraction service. Uses `@anthropic-ai/sdk` when `ANTHROPIC_API_KEY` is set; falls back to canned sample data keyed by filename otherwise.
- **ADDED** `src/features/intake/intake-router.ts` — tRPC router exposing `extractFromPdf` mutation that takes a base64-encoded PDF and returns the extracted fields.
- **ADDED** `src/features/intake/schemas.ts` — zod schemas for extraction output and form inputs, shared between server and client.
- **ADDED** a "New bill" button in the inbox toolbar (small scope creep into `add-bill-inbox` territory — cheapest to add here, noted in design.md).
- **ADDED** shadcn primitives needed: `form`, `command` (for vendor combobox), `calendar` (likely already there), `switch` or `tabs` (for choosing upload vs. manual).

## Impact

- The demo gains a natural entry point: `/bills/new`. "Here's what happens when a bill arrives in a vendor email" is the first story now.
- Users can create bills end-to-end without touching the seed script.
- LLM extraction is a signal feature — it proves the team understands where modern AP products are going, and the graceful fallback proves we're thoughtful about demo reliability.
- No schema changes. This consumes the existing `bill.create` mutation and the existing schema fields.

## Success criteria

- `/bills/new` renders a page with a visible choice: upload a PDF or fill the form manually.
- **Upload path:**
  - Dragging or selecting any PDF starts extraction. A loading state shows while the request is in flight.
  - On success, the form prefills with vendor name (matched to existing vendors or creates a new one), invoice number, amount, issue date, due date, and line items.
  - On failure (unknown filename with no key set), the form stays empty and an info banner says "We couldn't extract this automatically. Please fill it in manually."
- **Manual path:**
  - User picks a vendor from a combobox or creates a new one inline.
  - Amount, issue date, due date, memo, GL category, line items all editable.
  - Each line item has description, amount, Expense/Item dropdown.
  - Sum of line items must equal bill amount — validation shows an inline error if not.
- **Submission:**
  - "Save as draft" creates the bill in DRAFT status and navigates to the new bill's detail page.
  - "Submit for approval" creates the bill AND immediately invokes `bill.submit`, walking it through the auto-approve/require-approval branch based on amount.
- **Real OCR works when key is set:** setting `ANTHROPIC_API_KEY` in Vercel env + uploading a real invoice PDF extracts structured data. When unset, a handful of canned sample filenames produce realistic fallback data.
- Inbox toolbar shows a "New bill" button that navigates here.
- `npm run build` passes. Vercel deploy works with or without the key set.
