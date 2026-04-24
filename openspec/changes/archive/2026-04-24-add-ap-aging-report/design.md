# Design: add-ap-aging-report

## What an AP Aging Report actually is

A finance person's monthly ritual: pull the aging report, scan the 61+ bucket for anything embarrassing, chase those vendors, reconcile them out of the bucket. It's fundamentally four buckets and a sum per vendor — simple to compute, high signal to read.

Standard bucket boundaries (used across QuickBooks, NetSuite, Xero, Bill.com):

- **Current** — not yet due (dueDate >= today)
- **1–30 days overdue** — dueDate in `[today - 30, today - 1]`
- **31–60 days overdue** — dueDate in `[today - 60, today - 31]`
- **61+ days overdue** — dueDate < today - 60

For Settle's demo scale, four buckets is right. Real products sometimes add a 91+ or 120+ column. Not needed here.

## Page layout

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar                                                      │
├─────────────────────────────────────────────────────────────┤
│  AP Aging Report                          as of Apr 24, 2026│
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Current  │ │1–30 days│ │31–60    │ │61+ days │          │
│  │         │ │overdue  │ │overdue  │ │overdue  │          │
│  │ 8 bills │ │ 3 bills │ │ 1 bill  │ │ 0 bills │          │
│  │$23,400  │ │$18,200  │ │$12,500  │ │   $0    │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                              │
│  Vendor          Current  1–30    31–60   61+    Total     │
│  Amazon Web Svcs $8,423    —       —       —    $8,423    │
│  Latham & W.        —       —    $12,500    —   $12,500    │
│  ...                                                         │
│  ─────────────────────────────────────────────────────────  │
│  Grand total    $23,400  $18,200  $12,500  $0    $54,100   │
└─────────────────────────────────────────────────────────────┘
```

Summary band of four tiles at top, table below. Report-style layout — density over decoration.

## The service

`src/features/reports/report-service.ts`:

```ts
import 'server-only';
import { db } from '@/server/db';

const OUTSTANDING = ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] as const;

export async function getApAgingReport() {
  const today = startOfDay(new Date());

  const bills = await db.bill.findMany({
    where: { status: { in: OUTSTANDING } },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { vendor: { name: 'asc' } },
  });

  // Group by vendor, bucket by dueDate
  const byVendor = new Map<string, VendorRow>();
  const totals = { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 };

  for (const bill of bills) {
    const bucket = classifyAge(bill.dueDate, today);
    const row = byVendor.get(bill.vendorId) ?? {
      vendorId: bill.vendorId,
      vendorName: bill.vendor.name,
      current: 0, d1to30: 0, d31to60: 0, d61plus: 0,
    };
    row[bucket] += bill.amountCents;
    byVendor.set(bill.vendorId, row);
    totals[bucket] += bill.amountCents;
  }

  return {
    asOf: today,
    vendorRows: [...byVendor.values()],
    totals,
    billCount: {
      current: bills.filter(b => classifyAge(b.dueDate, today) === 'current').length,
      d1to30:  bills.filter(b => classifyAge(b.dueDate, today) === 'd1to30').length,
      d31to60: bills.filter(b => classifyAge(b.dueDate, today) === 'd31to60').length,
      d61plus: bills.filter(b => classifyAge(b.dueDate, today) === 'd61plus').length,
    },
  };
}

function classifyAge(dueDate: Date, today: Date): BucketKey {
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / DAY_MS);
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd1to30';
  if (daysOverdue <= 60) return 'd31to60';
  return 'd61plus';
}
```

One query, client-side grouping in memory. Could do the bucketing in SQL with `CASE WHEN`, but for demo scale (~14 bills) in-memory grouping is clearer and equally fast.

**Sorting:** vendors ordered alphabetically by name. An alternative is "vendors with anything in the 61+ bucket first, then 31–60, then the rest alphabetical" — which is what a finance person actually wants because it foregrounds the problem vendors. Worth considering if time allows, but alphabetical is defensible and simpler.

## The router

```ts
// src/features/reports/report-router.ts
import 'server-only';

export const reportRouter = router({
  apAging: publicProcedure.query(() => getApAgingReport()),
});
```

Registered under `reports` in `src/server/root-router.ts`.

## Visual treatment of severity

The 31–60 and 61+ buckets carry real signal — a bill 60 days overdue is a relationship problem, not just paperwork. Visually marking them:

- **Current** — neutral gray, no accent.
- **1–30** — subtle amber text on the number, no background change.
- **31–60** — stronger amber-to-red text.
- **61+** — red text, semibold.

The table cells follow the same color mapping: a vendor with an amount in the 61+ column has that amount rendered red. All other cells are neutral. This directs the eye to the problems without making the whole table look alarming.

`<AgingBucketPill>` is the reusable primitive that takes a bucket key and a value, applies the right color.

## Page composition

`src/app/reports/ap-aging/page.tsx` is a Server Component that:

1. Uses `createCaller` to fetch `getApAgingReport()` server-side.
2. Passes the result to `<ApAgingReport data={data} />`.
3. `metadata.title = 'AP Aging Report — Settle'`.

Entirely server-rendered. No interactivity, no useQuery. The report is a snapshot "as of now" — reload the page for a fresh snapshot. Adding a refresh button or live-updating feed would be overkill for the MVP.

## The "as of" date

Reports need a reference date. Showing "as of Apr 24, 2026" at the top right of the header tells the reader exactly when the snapshot was computed. Small detail, high-signal — it's how every accounting product presents aging reports.

## Empty-ish report handling

If all bills are PAID or REJECTED (nothing outstanding), the page still renders:

- Summary tiles all show 0 / $0.
- Table renders a "No outstanding bills" row instead of the vendor list.
- Grand total row still renders with zeros.

Not a common case with seed data, but the empty path shouldn't break.

## Why the dashboard doesn't already cover this

The dashboard's "Cash out next 30 days" tile is forward-looking (bills due in the future). The aging report is backward-looking (bills past due). Different lens, different use case. The dashboard tells you what's coming; the report tells you what's behind.

Some products combine these into one view. The MVP keeps them separate because (a) the dashboard is an at-a-glance surface and (b) the aging report is a focused analytical artifact.

## What this change does not do

- No CSV export. Real products offer it. For an MVP, copy-paste from the table is acceptable.
- No date-picker "as of" override. Reports snap to today. A finance-close workflow would want "as of month-end," but that's out of scope.
- No PDF export. Same reasoning.
- No drill-down from a cell to a filtered list of those bills. Would be a nice affordance but adds navigation complexity not worth the scope cost.
- No comparison to prior period ("aging as of last month vs. this month"). That's a real-product feature; out of scope.
- No currency breakdown — USD only, matches the rest of the app.
- No vendor-specific view. Clicking a vendor name does not navigate anywhere.
- Custom bucket boundaries are not configurable. The 30/60/90 split is hardcoded, matching industry convention.