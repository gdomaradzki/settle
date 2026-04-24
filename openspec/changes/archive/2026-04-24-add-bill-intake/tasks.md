# Tasks: add-bill-intake

## Dependencies

- [x] Install `@anthropic-ai/sdk`.
- [x] Install `react-hook-form` + `@hookform/resolvers` (if not already present).
- [x] Install shadcn primitives: `npx shadcn@latest add form command`. (`calendar`, `popover`, `dialog` should already be present from `add-bill-detail`.)
- [x] Ensure `zod` is present (it is).

## Sample PDFs and canned extractions

- [x] Place 3-4 invoice PDFs under `public/samples/`:
  - `aws-invoice.pdf`
  - `wework-invoice.pdf`
  - `latham-invoice.pdf`
  - `notion-invoice.pdf`
  - Source: any realistic-looking invoice PDFs. Hand-crafted or downloaded examples. Reasonable content matching vendor names.
- [x] Create `src/features/intake/lib/canned-extractions.ts` with the `CANNED` map and `REASONABLE_DEFAULT` values. Keep amounts, dates, and line items plausible.

## Schemas

- [x] Create `src/features/intake/schemas.ts`:
  - `InvoiceExtractionSchema` — zod schema for extraction output (`vendorName`, `invoiceNumber`, `amountCents`, `issueDate` as ISO string, `dueDate` as ISO string, `lineItems` array).
  - `BillFormSchema` — zod schema for the form (dates as `z.date()`, all fields with inline messages). Includes two `.refine` cross-field validations: line-items-sum-equals-amount, due-date-not-before-issue-date.
  - Export `type InvoiceExtraction = z.infer<...>` and `type BillFormValues = z.infer<...>`.

## Extraction service

- [x] Create `src/features/intake/services/extract-invoice-data.ts`:
  - `import 'server-only';`
  - Exports `extractInvoiceData(pdfBase64, filename): Promise<InvoiceExtraction>`.
  - If `process.env.ANTHROPIC_API_KEY` unset → return `getCannedExtraction(filename)`.
  - If set: call Anthropic SDK with a document content block, parse JSON response, validate with `InvoiceExtractionSchema`.
  - On any error (API failure, JSON parse failure, schema mismatch): log the error, fall back to canned extraction. The demo must never break.
  - Include the extraction prompt as a constant in the file.
  - Uses model `claude-sonnet-4-6` (latest Sonnet at time of implementation).

## tRPC router

- [x] Create `src/features/intake/intake-router.ts`:
  - `import 'server-only';`
  - `extractFromPdf` mutation: input `{ pdfBase64: string, filename: string }`, output typed to `InvoiceExtraction`.
  - Delegates to `extractInvoiceData`.
- [x] Register `intakeRouter` under `intake` in `src/server/root-router.ts`.

## Vendor router extension

- [x] Verify or add `src/features/vendors/vendor-router.ts`:
  - `list` query returning all vendors ordered by name, selecting needed fields.
  - `create` mutation: input `{ name: string, email?: string, paymentMethod: PaymentMethod }` → inserts and returns the vendor.
- [x] Register `vendorRouter` under `vendors` in `src/server/root-router.ts` if not already registered.

## PDF uploader component

- [x] Create `src/features/intake/components/pdf-uploader.tsx`:
  - Client component.
  - Drag-and-drop target with a click fallback via hidden `<input type="file" accept="application/pdf">`.
  - Validates file size ≤ 10MB before processing; toast.error otherwise.
  - Reads the file as base64 via `FileReader`.
  - Calls `trpc.intake.extractFromPdf.useMutation()` and forwards the resulting extraction + filename to an `onExtracted` callback.
  - Three visual states: idle, uploading (spinner), error (red border + message, dismissible).

## Line items field array

- [x] Create `src/features/intake/components/line-items-field.tsx`:
  - Client component.
  - Uses `useFieldArray` from `react-hook-form`.
  - Renders each line item row: description input, amount input (with $ prefix), Expense/Item select, remove button.
  - "+ Add line item" button below the list.
  - Auto-updates `amountCents` on the bill form when line items change, UNLESS the user has manually edited the bill amount (tracked with a local ref).

## Vendor combobox

- [x] Create `src/features/intake/components/vendor-combobox.tsx`:
  - Client component.
  - Props: `value: string | null`, `onChange: (vendorId: string) => void`, `initialVendorName?: string` (from extraction).
  - Uses shadcn `Popover` + `Command` + `CommandInput` + `CommandList`.
  - Shows existing vendors filtered by input.
  - Has a "+ Create new vendor" option that opens a nested dialog.
  - The inline create dialog has name + paymentMethod + optional email, calls `trpc.vendor.create`, selects the new vendor on success.
  - When `initialVendorName` is provided, tries a case-insensitive exact match on mount; if no match, opens the create dialog pre-filled.

## Bill intake form

- [x] Create `src/features/intake/components/bill-intake-form.tsx`:
  - Client component.
  - Props: `initialExtraction?: InvoiceExtraction`.
  - `useForm<BillFormValues>` with `zodResolver(BillFormSchema)`.
  - On mount, if `initialExtraction` is provided: maps it to the form via `form.setValue` calls.
  - Layout: vendor picker, invoice number, amount, issue date, due date, memo, GL category, line items array.
  - Two footer buttons: "Save as draft" (secondary), "Submit for approval" (primary).
  - Save as draft → `trpc.bill.create.useMutation()` → navigate to detail page.
  - Submit for approval → `create` then chained `submit` → navigate to detail page.
  - Mutations invalidate `bill.list`.
  - Inline validation errors via shadcn `Form` components.

## Page composition

- [x] Create `src/features/intake/components/bill-intake-page.tsx`:
  - Client component.
  - State: `extraction: InvoiceExtraction | null`, `mode: 'choose' | 'form'`.
  - On mount: `mode = 'choose'`, shows the PdfUploader prominently + a "or enter manually" link.
  - On uploader's `onExtracted`: set extraction state, set `mode = 'form'`, scroll the form into view.
  - On "enter manually" click: set `mode = 'form'` with `extraction = null`.
  - Once in form mode: render `<BillIntakeForm initialExtraction={extraction} />` with a subdued "Replace PDF" link at the top that resets back to `choose` mode.
- [x] Create `src/app/bills/new/page.tsx`:
  - Server Component.
  - Renders `<BillIntakePage />`.
  - `metadata.title = 'New bill — Settle'`.

## Inbox toolbar button

- [x] Edit `src/app/bills/page.tsx` (or the toolbar component inside it):
  - Add a primary "+ New bill" button next to the search input.
  - Links to `/bills/new`.

## Environment variable documentation

- [x] Edit `.env.example`:
  - Add `ANTHROPIC_API_KEY=` (commented out) and a comment explaining it's optional with canned fallback behavior.
- [x] Edit README setup steps to mention that the key is optional and how extraction behaves without it.

## Verification

- [x] `npm run build` passes.
- [x] With `ANTHROPIC_API_KEY` unset:
  - [x] Navigate to `/bills/new`.
  - [x] Drag `public/samples/aws-invoice.pdf` into the uploader.
  - [x] Form transitions to form mode; fields are prefilled with AWS data from the canned map.
  - [x] Line items show with Expense/Item classification.
  - [x] Upload a random PDF not in the canned map — form mode with empty defaults + info banner.
- [x] Click "or enter manually" from the choose screen — form renders empty, vendor picker opens.
- [x] Vendor creation:
  - [x] Type a new vendor name in the combobox → "+ Create new vendor" option appears.
  - [x] Click it → dialog opens, fill name + method, confirm → vendor selected.
- [x] Line items:
  - [x] Enter two line items, amounts summing to $1,000.
  - [x] Bill amount auto-updates to $1,000.
  - [x] Manually change bill amount to $1,500. Add a third line item to bring sum to $1,500 — amount doesn't overwrite because user touched it.
  - [x] Make line items sum to $1,400. Try to submit. Validation error: "Line items must sum to the bill amount."
- [x] Dates: set due date before issue date. Validation error inline.
- [x] Save as draft:
  - [x] With valid form, click "Save as draft." Navigates to `/bills/[newId]`. Status shows DRAFT.
- [x] Submit for approval:
  - [x] From `/bills/new`, fill form with amount $3,000 (under threshold). Click "Submit for approval." Navigates to detail page. Bill is APPROVED (auto-approved). Timeline shows created + submitted + approved.
  - [x] Repeat with amount $8,000 (over threshold). Submit. Bill is PENDING_APPROVAL.
- [x] Inbox toolbar: "+ New bill" button visible on `/bills`, clicking it navigates to `/bills/new`.
- [x] With `ANTHROPIC_API_KEY` set (via Vercel env or `.env.local`):
  - [x] Upload any real invoice PDF (not one of the samples).
  - [x] Extraction runs, form prefills with data derived from the actual PDF content.
  - [x] If the PDF is nonsense or unrelated, extraction may fail gracefully — form mode with empty defaults, no hard crash.
- [x] Deploy to Vercel — live URL renders.

## Definition of done

- All checkboxes above are ticked.
- Demo can open with "let me show you how a bill enters the system" — upload, watch extraction, confirm, submit — not "here is a bill that conveniently exists."
- With the key unset, the canned fallback keeps the demo reliable.
- With the key set, real extraction works on real invoices.
- `openspec validate --strict add-bill-intake` passes.
