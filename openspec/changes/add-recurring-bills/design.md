# Design: add-recurring-bills

## Schema

```prisma
model BillTemplate {
  id          String    @id @default(cuid())
  vendorId    String
  amountCents Int
  dayOfMonth  Int       // 1..28; enforced by zod, not by DB check constraint
  memo        String?
  glCategory  String?
  cancelledAt DateTime?
  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  vendor    Vendor                 @relation(fields: [vendorId], references: [id])
  lineItems BillTemplateLineItem[]
  bills     Bill[]                 @relation("RecurringTemplateBills")

  @@index([cancelledAt, dayOfMonth])
}

model BillTemplateLineItem {
  id          String       @id @default(cuid())
  templateId  String
  description String
  amountCents Int
  type        LineItemType @default(EXPENSE)
  glCategory  String?

  template BillTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

// On Bill, add:
//   recurringTemplateId String?
//   recurringTemplate   BillTemplate? @relation("RecurringTemplateBills", fields: [recurringTemplateId], references: [id])
//
// New unique index:
//   @@unique([recurringTemplateId, dueDate])
```

### Why a related table for line items, not JSON

The existing bills domain already enforces "Bill line items are structured, not JSON" with a dedicated `BillLineItem` table. Mirroring that for templates keeps the model uniform: line items everywhere are queryable rows with their own GL categories and types, never opaque JSON blobs. The cost is one extra table and a cascade delete; the benefit is that future reporting (e.g., "total spend per GL category across all templates") is a simple SQL query instead of a JSON unnest.

### Why `dayOfMonth` is capped at 28

Months have 28 to 31 days. A template scheduled for the 31st would silently skip February, April, June, September, and November — surprising behavior. Capping at 28 means every template fires every month, period. Users who want "last day of the month" must wait for a future change with explicit UI. Documented as a known limit.

The cap is enforced in the zod schema (`z.number().int().min(1).max(28)`), not as a Prisma `@db.SmallInt` constraint or a Postgres `CHECK`. Zod is sufficient because every write goes through tRPC; a direct DB write bypassing zod is already a code-review failure under the project's domain-driven conventions.

### The `(recurringTemplateId, dueDate)` unique index

Idempotency keyed on this pair. Postgres treats NULL as distinct in unique indexes, so manually-created bills (with `recurringTemplateId = null`) don't conflict with each other. Two cron-generated bills for the same template+date *do* conflict, which is exactly what we want — the second generation attempt fails the unique constraint and is treated as `skipped`.

The composite index also accelerates the cron's "does an instance for this template+date already exist?" pre-check (when used).

## The bill creation path

The existing requirement says every bill status change goes through `bill-service.ts`. To stay consistent, this change adds one new function there:

```ts
// bill-service.ts
async function createScheduledBillFromTemplateInner(
  tx: Tx,
  template: BillTemplate & { lineItems: BillTemplateLineItem[] },
  dueDate: Date,
  actorId: string,
): Promise<Bill> {
  const now = new Date();
  const bill = await tx.bill.create({
    data: {
      vendorId: template.vendorId,
      amountCents: template.amountCents,
      currency: 'USD',
      issueDate: now,
      dueDate,
      status: 'SCHEDULED',
      memo: template.memo,
      glCategory: template.glCategory,
      submittedAt: now,
      approvedAt: now,
      approvedById: actorId,
      scheduledPayDate: dueDate,
      scheduledMethod: /* read from vendor.paymentMethod */,
      createdById: actorId,
      recurringTemplateId: template.id,
    },
  });

  if (template.lineItems.length > 0) {
    await tx.billLineItem.createMany({
      data: template.lineItems.map((li) => ({
        billId: bill.id,
        description: li.description,
        amountCents: li.amountCents,
        type: li.type,
        glCategory: li.glCategory,
      })),
    });
  }

  await tx.billEvent.createMany({
    data: [
      {
        billId: bill.id,
        type: 'created',
        actorId,
        payload: { source: 'recurring', templateId: template.id, autoApproved: 'true' },
      },
      {
        billId: bill.id,
        type: 'scheduled',
        actorId,
        payload: { payDate: dueDate.toISOString(), method: bill.scheduledMethod },
      },
    ],
  });

  return bill;
}

export async function createScheduledBillFromTemplate(
  template: BillTemplate & { lineItems: BillTemplateLineItem[] },
  dueDate: Date,
  actorId: string,
): Promise<Bill> {
  return db.$transaction((tx) =>
    createScheduledBillFromTemplateInner(tx, template, dueDate, actorId),
  );
}
```

Two events, not four (`created`, `submitted`, `approved`, `scheduled`). Rationale: the meaningful audit story for a recurring bill is "the template generated it" + "it's already scheduled." Padding the timeline with `submitted` and `approved` events whose actor is also the template creator would clutter the UI without adding information. The `created` event's payload (`source: "recurring"`, `autoApproved: "true"`) carries the auto-approve metadata.

The bill's lifecycle timestamp columns (`submittedAt`, `approvedAt`, `approvedById`) are still populated, so the existing detail-page UI that reads those columns directly continues to render the correct dates and "approved by" attribution. The two-event model is a UI choice; the row-level data is complete.

## The cron job

```ts
// src/features/templates/generate-recurring-bills.ts
export const generateRecurringBills: CronJob = {
  name: 'generate-recurring-bills',
  description: 'Generates new bill instances from active recurring templates whose dayOfMonth matches today.',
  async run(ctx) {
    const today = startOfDayUtc(ctx.now);
    const dayOfMonth = today.getUTCDate();

    if (dayOfMonth > 28) {
      // Templates only fire on days 1..28. On the 29th-31st, no work to do.
      return { jobName: 'generate-recurring-bills', processed: 0, skipped: 0, errors: [] };
    }

    const templates = await ctx.db.billTemplate.findMany({
      where: { cancelledAt: null, dayOfMonth },
      include: { lineItems: true },
    });

    let processed = 0;
    let skipped = 0;
    const errors: Array<{ id?: string; message: string }> = [];

    for (const template of templates) {
      try {
        await createScheduledBillFromTemplate(template, today, template.createdById);
        processed++;
      } catch (err) {
        // Postgres unique-constraint violation = idempotent skip, not error.
        if (isUniqueViolation(err)) {
          skipped++;
        } else {
          errors.push({
            id: template.id,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { jobName: 'generate-recurring-bills', processed, skipped, errors };
  },
};
```

`startOfDayUtc` normalizes `ctx.now` to UTC midnight. Every template's generated bill for today shares the same `dueDate` value, which makes the unique index work cleanly.

`isUniqueViolation` is a small helper that checks for Prisma error code `P2002`. A unique violation here is the *expected* outcome of running the cron a second time — it's how idempotency is achieved. Treating it as `skipped` rather than `errors` keeps the JobResult clean.

## Actor choice

For change `add-scheduled-payment-execution`, the cron uses a designated System user. This change does NOT introduce a System user; instead, every `BillEvent` and the generated `Bill.createdById`/`approvedById` carry `template.createdById` — the human who set up the template.

Rationale:

1. **The template's creator is morally the actor.** They made the recurrence happen. Saying "Gus created this bill from his rent template" is accurate.
2. **Independence from `add-scheduled-payment-execution`.** That change owns the System user. This change can ship in either order without depending on or conflicting with it.
3. **Audit clarity is preserved.** The `created` event's payload contains `source: "recurring"` and the template id. Anyone reading the timeline can see that this was an auto-generated bill, even though the actor is a human.

If both changes ship and a unified actor model is later wanted, a follow-up can switch this change's cron to use the System user. The contract on `actorId` is just "some valid user id" — the choice is local to the cron.

## "Generate next instance now" demo button

The detail page exposes a button that calls `templates.runGenerationForOne` (or similar tRPC mutation). The mutation invokes the same `createScheduledBillFromTemplate` the cron uses, scoped to a single template, with `dueDate = today`. It catches the unique-violation case and surfaces an explicit "already generated for today" toast — same code path, different feedback.

This is the manual-trigger affordance for the demo. The cron does the same thing daily; the button is for proving it works during a walkthrough.

## Cancellation semantics

Setting `cancelledAt` stops future generation. In-flight bills already in `SCHEDULED` are NOT touched — they proceed through the existing payment cron normally.

Why not cascade-cancel the in-flight bills? Two reasons:

1. **Real-world AP behavior.** Cancelling a SaaS subscription doesn't unwind the bill that's already in flight for the current cycle.
2. **Demo path simplicity.** The cancel button does one thing: stamp `cancelledAt`. No additional state to reason about.

## tRPC and UI surface

```
src/features/templates/
├── components/
│   ├── template-list.tsx
│   ├── template-detail.tsx
│   └── new-template-form.tsx
├── template-service.ts        # CRUD + createScheduledBillFromTemplate orchestration
├── template-router.ts         # tRPC: list, get, create, cancel, runGenerationForOne
├── generate-recurring-bills.ts # CronJob export
└── schemas.ts                 # zod inputs
```

Routes:

- `/templates` — list page (server component fetching `templates.list` via tRPC caller).
- `/templates/new` — create form (client component using `templates.create`).
- `/templates/[id]` — detail page; shows template fields, past instances ordered by `dueDate` desc, "Generate next instance now" button, "Cancel template" action.

## What this change does NOT do

- **No frequency other than monthly.** No `cron` strings, no RRULE, no weekly/quarterly.
- **No day-of-month above 28.** Documented limit.
- **No template editing.** Cancel + create new.
- **No retroactive cancellation.** Already-scheduled bills proceed.
- **No System user.** The template's creator is the actor.
- **No notifications.** Surfaces in dashboard on next navigation.
- **No support for paying ahead.** The generated bill carries `scheduledPayDate = today` (= `dueDate`), so `add-scheduled-payment-execution` will pay it on the same day it's generated. That's the intended demo path.
