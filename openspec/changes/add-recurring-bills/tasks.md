# Tasks: add-recurring-bills

## Schema — Prisma

- [ ] In `prisma/schema.prisma`, add the `BillTemplate` model with fields: `id`, `vendorId`, `amountCents`, `dayOfMonth`, `memo?`, `glCategory?`, `cancelledAt?`, `createdById`, `createdAt`, `updatedAt`. Relations: `vendor` (to `Vendor`), `lineItems` (to `BillTemplateLineItem`), `bills` (named relation `RecurringTemplateBills` to `Bill`). Index `@@index([cancelledAt, dayOfMonth])`.
- [ ] Add the `BillTemplateLineItem` model with fields: `id`, `templateId`, `description`, `amountCents`, `type` (default `EXPENSE`), `glCategory?`. Relation `template` to `BillTemplate` with `onDelete: Cascade`.
- [ ] On the existing `Bill` model, add `recurringTemplateId String?` and the matching relation `recurringTemplate BillTemplate? @relation("RecurringTemplateBills", fields: [recurringTemplateId], references: [id])`.
- [ ] Add `@@unique([recurringTemplateId, dueDate])` on `Bill`. Verify in a Prisma Studio session (or via `psql`) that the index permits multiple NULL values for `recurringTemplateId` (Postgres treats NULLs as distinct).
- [ ] Run `npx prisma migrate dev --name add-recurring-bill-templates` and verify the migration file is committed.

## Schema — types

- [ ] Confirm `@/generated/prisma/client` exposes `BillTemplate` and `BillTemplateLineItem` after `npx prisma generate`. No additional manual exports needed.

## Service — bill creation from template

- [ ] In `src/features/bills/bill-service.ts`, add `createScheduledBillFromTemplateInner(tx, template, dueDate, actorId)` that:
  - Inserts a `Bill` with `status = SCHEDULED`, all lifecycle timestamps (`submittedAt`, `approvedAt`, `approvedById`, `scheduledPayDate`, `scheduledMethod`) populated, `recurringTemplateId = template.id`.
  - `scheduledMethod` is read from `template.vendor.paymentMethod` (load the vendor inside the function or accept it pre-loaded).
  - Inserts each line item from `template.lineItems` into `BillLineItem`.
  - Inserts two `BillEvent` rows in one `createMany`: a `created` event with payload `{ source: "recurring", templateId, autoApproved: "true" }` and a `scheduled` event with payload `{ payDate, method }`.
- [ ] Export `createScheduledBillFromTemplate` (the public, transaction-wrapped version).

## Service — templates

- [ ] Create `src/features/templates/schemas.ts` with zod schemas:
  - `CreateTemplateInput` (vendorId, amountCents, dayOfMonth `min(1).max(28)`, memo?, glCategory?, lineItems array).
  - `CancelTemplateInput` (templateId).
- [ ] Create `src/features/templates/template-service.ts`:
  - `import 'server-only';`
  - `createTemplate(input, actorId)` — inserts `BillTemplate` + `BillTemplateLineItem` rows in one transaction.
  - `listTemplates({ includeCancelled?: boolean })` — returns templates ordered by createdAt desc; filters out cancelled by default.
  - `getTemplate(templateId)` — returns the template with its line items, vendor, and a list of generated bills (ordered by `dueDate` desc).
  - `cancelTemplate(templateId, actorId)` — sets `cancelledAt = now` if not already set; returns the updated template.
  - `runGenerationForTemplate(templateId, dueDate)` — calls `createScheduledBillFromTemplate` for one template; catches Prisma `P2002` and re-throws as a domain error so the router can produce a friendly toast.
- [ ] Create `src/features/templates/template-router.ts` exposing `list`, `get`, `create`, `cancel`, `runGenerationForOne` mutations and queries via tRPC. Maps the `P2002`-derived domain error to `TRPCError({ code: "CONFLICT", message: "An instance for this template and due date already exists." })`.
- [ ] Register `templateRouter` in `src/server/root-router.ts` under `templates`.

## Service — the cron job

- [ ] Create `src/features/templates/generate-recurring-bills.ts`:
  - `import 'server-only';`
  - Exports `generateRecurringBills: CronJob` (named export).
  - `run(ctx)`:
    - Computes `today = startOfDayUtc(ctx.now)` and `dayOfMonth = today.getUTCDate()`.
    - Returns an empty/zero-count JobResult immediately if `dayOfMonth > 28`.
    - Queries `ctx.db.billTemplate.findMany({ where: { cancelledAt: null, dayOfMonth }, include: { lineItems: true, vendor: true } })`.
    - For each template: try `createScheduledBillFromTemplate(template, today, template.createdById)`.
    - Catches Prisma error code `P2002` (unique violation) and counts the template under `skipped` (not `errors`).
    - Other errors append `{ id: template.id, message }` to `errors`.
    - Returns `{ jobName: "generate-recurring-bills", processed, skipped, errors }`.

## Registry — register the job

- [ ] In `src/server/cron/registry.ts`, append `generateRecurringBills` to `cronRegistry`. Import path: `@/features/templates/generate-recurring-bills`.
- [ ] Confirm the diff is exactly two lines: one `import` and one array entry. The registry's structure SHALL NOT change.

## UI — templates routes

- [ ] Create `src/app/templates/page.tsx` (server component) — calls `templates.list` via tRPC caller, renders a list of active templates with vendor name, amount, day-of-month, and a link to each detail page. Page header includes a "+ New recurring bill" link to `/templates/new`.
- [ ] Create `src/app/templates/new/page.tsx` (client component) — renders `<NewTemplateForm />` from the templates feature. Form uses react-hook-form + zod. Submit calls `templates.create`.
- [ ] Create `src/app/templates/[id]/page.tsx` (server component) — fetches the template + past instances, renders `<TemplateDetail />`. Detail component includes:
  - Template fields (vendor, amount, day-of-month, memo, GL category).
  - List of past generated bills with status pill and link to `/bills/[id]`.
  - "Generate next instance now" button (calls `templates.runGenerationForOne`). Disabled if the template is cancelled.
  - "Cancel template" button (calls `templates.cancel`). Hidden if already cancelled.
  - When cancelled, shows a muted block "Cancelled on <date>".
- [ ] Add a "Templates" link to the app shell's navigation, alongside the existing Bills/Vendors/Reports links.

## Seed

- [ ] In `prisma/seed.ts`, add at least one active recurring template after the existing bill seed block. Suggested: monthly office rent, vendor "Beacon Property Management", amount $4,500.00 = 450_000 cents, dayOfMonth 1, line item "Office rent — May".
- [ ] The seed SHALL be idempotent: re-running it does not duplicate templates or their line items. Use `upsert` keyed on a stable id, or check for existence before insert.

## Verification

- [ ] `npx prisma migrate dev` runs clean and produces a migration file.
- [ ] `npm run db:seed` runs clean and produces the seeded template.
- [ ] `npm run build` passes clean. No TypeScript errors.
- [ ] Manual demo flow:
  1. Visit `/templates` — the seeded rent template is shown.
  2. Open the template's detail page — fields render, past instances list is empty (or has any seeded examples).
  3. Click "Generate next instance now" — the page refreshes; a new bill appears in the past-instances list with status `SCHEDULED` and a `dueDate` of today.
  4. Open the generated bill's detail page — timeline shows two events (`created` with `source: "recurring"` in payload, `scheduled` with the method/payDate). Status pill is `SCHEDULED`.
  5. Click "Generate next instance now" again — the toast reads "An instance for this template and due date already exists." (CONFLICT), no second bill is created.
- [ ] Cancellation check:
  1. Click "Cancel template" — the page reloads showing the muted "Cancelled on <date>" block. The "Generate next instance now" button is disabled or hidden.
  2. Run `generate-recurring-bills` from `/admin/cron` — JobResult shows `processed: 0` (the cancelled template is excluded by the `cancelledAt: null` filter).
  3. Already-scheduled bills from this template are still listed on the inbox and can be paid normally.
- [ ] Cron idempotency check:
  1. With at least one active template whose `dayOfMonth = today.getUTCDate()`, click "Run now" on `generate-recurring-bills` from `/admin/cron`. JobResult shows `processed: N` (where N is the number of due-today templates without an existing instance).
  2. Click "Run now" again immediately. JobResult shows `processed: 0, skipped: N, errors: []`.
- [ ] `openspec validate --strict add-recurring-bills` passes.

## Definition of done

- All checkboxes above are ticked.
- The Prisma migration is committed alongside the application code.
- `cronRegistry` has at least one entry: `generateRecurringBills`. (If `add-scheduled-payment-execution` has already merged, then it has both; the order between them is not load-bearing.)
- No changes outside `src/features/templates/`, `src/features/bills/bill-service.ts` (one new exported function), `src/server/cron/registry.ts` (one append), `src/app/templates/`, `src/app/<app-shell-nav>` (a single nav link), `prisma/schema.prisma`, and `prisma/seed.ts`.
- The change does not touch `src/server/cron/types.ts`, `src/server/cron/runner.ts`, the cron route handlers, the admin page, the System user, `payBillInner`, or `process-scheduled-payments`. Conflicts there mean either change 1's infrastructure design needs revision or change 2's territory was crossed by mistake.
