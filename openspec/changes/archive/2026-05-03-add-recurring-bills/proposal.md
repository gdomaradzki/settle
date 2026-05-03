# Change: add-recurring-bills

## Why

Most real AP work is recurring: rent, SaaS subscriptions, insurance, retainers. Today every monthly bill has to be entered manually each month — the demo can't show the most common AP workflow at all. There is no concept of a recurring template anywhere in the schema or UI.

This change introduces a template-based system. A user creates a `BillTemplate` once (vendor, amount, day-of-month, line items). On every daily cron tick, every active template whose `dayOfMonth` matches today auto-generates a new `Bill` instance in `SCHEDULED` status. The instance flows through the rest of the AP lifecycle through the existing bill service — once scheduled, it's just a regular bill from there on out.

## What changes

- **ADDED** `templates` domain: new `BillTemplate` Prisma model (vendor reference, amount in cents, day-of-month 1-28, memo, GL category, cancelledAt, createdById, timestamps) and a related `BillTemplateLineItem` table.
- **ADDED** `bills` domain: nullable `recurringTemplateId` column on `Bill` with a foreign key to `BillTemplate`. A composite unique index `(recurringTemplateId, dueDate)` enforces idempotency for cron-driven generation. Manually-created bills carry `recurringTemplateId = null` and are unaffected.
- **ADDED** `bills` domain: `createScheduledBillFromTemplate(tx, template, dueDate, actorId)` in `bill-service.ts` — the only sanctioned way to create a bill in non-`DRAFT` status. Writes a `created` and a `scheduled` `BillEvent` in a single transaction.
- **ADDED** `templates` domain: cron job named `generate-recurring-bills` registered in `cronRegistry`. Lives at `src/features/templates/generate-recurring-bills.ts`. Finds active templates whose `dayOfMonth = today.getUTCDate()`, for each calls `createScheduledBillFromTemplate` inside a per-template transaction. Idempotent via the unique constraint.
- **ADDED** `templates` domain: tRPC router (`templates.list`, `templates.get`, `templates.create`, `templates.cancel`, `templates.runGenerationNow`) and zod schemas under `src/features/templates/`.
- **ADDED** `templates` domain: UI under `src/app/templates/`:
  - `/templates` — list of active templates with a "+ New recurring bill" button.
  - `/templates/new` — create form.
  - `/templates/[id]` — detail page showing template fields, past instances, "Generate next instance now" demo button, "Cancel" action.
- **ADDED** seed data: at least one active recurring template (e.g., monthly office rent) so the templates page is non-empty on a fresh `db:seed`.

## Impact

- The most common AP workflow becomes demoable: "set up the rent template once, watch it spawn a new bill on the 1st of every month."
- Generated bills feed straight into the rest of the lifecycle. They're picked up by `process-scheduled-payments` (from `add-scheduled-payment-execution`) on their pay date. The two features compose without coupling.
- Existing manual bill flows are untouched. The new `recurringTemplateId` column is nullable; every existing bill carries `null`.

## Success criteria

- The Prisma migration adds the `BillTemplate` and `BillTemplateLineItem` tables, the `Bill.recurringTemplateId` column, and the `(recurringTemplateId, dueDate)` unique index. `npx prisma migrate dev` runs clean.
- After registering the job, `/admin/cron` lists `generate-recurring-bills`.
- Visiting `/templates` shows the seeded rent template (or whatever the seed names it).
- Clicking "Generate next instance now" on the rent template's detail page produces a new `SCHEDULED` bill whose `recurringTemplateId` matches the template, whose `dueDate` is today, whose `scheduledPayDate` is today, and whose timeline shows `created` and `scheduled` events.
- Running the cron job twice in a row on the same day produces a JobResult with `processed: 0, skipped: <count of templates due today>` on the second run (the unique constraint catches the duplicate; the job treats it as `skipped`, not `errors`).
- Cancelling a template via the detail page sets `cancelledAt`. The next cron tick whose date matches `dayOfMonth` does NOT generate a new bill for that template.
- A bill already in `SCHEDULED` from a now-cancelled template still proceeds normally through the existing payment cron — cancellation does NOT retroactively touch generated bills.
- `npm run build` passes clean. `openspec validate --strict add-recurring-bills` passes.

## What this change does NOT do

- **No frequencies other than monthly.** No weekly, no quarterly, no day-of-week scheduling. Just `dayOfMonth`.
- **No day-of-month above 28.** Templates can fire on the 1st through 28th. A user wanting "last day of the month" must wait for a future change. Documented as a known limit.
- **No per-instance re-approval.** Generated bills land in `SCHEDULED` directly with the auto-approve marker on their `BillEvent` payload. The template was approved at setup (manually, by a human creating it); requiring re-approval each month would be demo theatre.
- **No template editing after creation.** Templates are immutable except for `cancelledAt`. A user who wants different terms cancels the old template and creates a new one. Edit-in-place is a future change with nontrivial UX (does the edit apply retroactively to in-flight bills? to past bills?).
- **No notification when a bill is generated.** Like `add-scheduled-payment-execution`, this surfaces in the dashboard on next navigation.
- **No coupling to `add-scheduled-payment-execution`.** This change creates `SCHEDULED` bills; the other change consumes them. They share neither code nor data beyond the standard `Bill` row.
