# Tasks: add-recurring-bills

Tasks are ordered to be executed top-to-bottom.

## Schema

- [x] Add `BillTemplate` and `BillTemplateLineItem` models to `prisma/schema.prisma`.
- [x] Add `recurringTemplateId String?` to `Bill`.
- [x] Add relation `recurringTemplate BillTemplate? @relation("RecurringTemplateBills", ...)` to `Bill`.
- [x] Add `@@unique([recurringTemplateId, dueDate])` to `Bill`.
- [x] Add `@@index([cancelledAt, dayOfMonth])` to `BillTemplate`.
- [x] Add `templates BillTemplate[]` relation to `Vendor`.
- [x] Run `npx prisma migrate dev --name add-recurring-bill-templates`.
- [x] Run `npx prisma generate`.

## Service layer

- [x] Add `TemplateWithVendorAndLineItems` type to `src/features/bills/bill-service.ts`.
- [x] Add `createScheduledBillFromTemplateInner` to `src/features/bills/bill-service.ts`.
- [x] Add `createScheduledBillFromTemplate` (public wrapper) to `src/features/bills/bill-service.ts`.
- [x] Create `src/features/templates/schemas.ts`.
- [x] Create `src/features/templates/template-service.ts` with `createTemplate`, `listTemplates`, `getTemplate`, `cancelTemplate`, `runGenerationForTemplate`.
- [x] Create `src/features/templates/template-router.ts`.
- [x] Create `src/features/templates/generate-recurring-bills.ts` exporting `generateRecurringBills: CronJob`.
- [x] Create `src/server/cron/types.ts` (matches sibling change add-scheduled-payment-execution).
- [x] Create `src/server/cron/registry.ts` with `cronRegistry`.

## Wiring

- [x] Register `templateRouter` in `src/server/root-router.ts` under `templates`.
- [x] Add "Templates" link to `src/components/top-bar.tsx`.

## UI

- [x] Create `app/templates/page.tsx` (templates list).
- [x] Create `app/templates/new/page.tsx` + `src/features/templates/components/new-template-form.tsx`.
- [x] Create `app/templates/[id]/page.tsx` + `src/features/templates/components/template-detail-view.tsx`.

## Seed

- [x] Update `prisma/seed.ts`:
  - Add `billTemplateLineItem.deleteMany()` and `billTemplate.deleteMany()` to wipe block.
  - Upsert Beacon Property Management vendor.
  - Upsert office rent template.

## Verification

- [x] `npx prisma format` — schema formats without errors.
- [x] `npx prisma migrate dev --name add-recurring-bill-templates` — migration applies cleanly.
- [x] `npm run db:seed` — seed runs without errors (idempotent on second run).
- [x] `npm run build` — must pass clean.
- [x] `npx openspec validate --strict add-recurring-bills` — must print "Change 'add-recurring-bills' is valid".

## Definition of Done

All tasks checked, `npm run build` passes, seed is idempotent, templates UI renders.
