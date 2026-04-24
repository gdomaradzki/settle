# Design: add-dashboard

## Page structure

```
┌────────────────────────────────────────────────────────────┐
│  TopBar                                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Welcome, Gus                                              │
│  Here's what's happening in your accounts payable today.   │
│                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐ │
│  │ Needs my        │ │ Due this week   │ │ Cash out     │ │
│  │ approval        │ │                  │ │ next 30 days │ │
│  │                  │ │                  │ │              │ │
│  │      3           │ │      5           │ │  $47,230.00  │ │
│  │                  │ │                  │ │              │ │
│  │ View →          │ │ View →          │ │              │ │
│  └─────────────────┘ └─────────────────┘ └──────────────┘ │
│                                                             │
│  Recent activity                                           │
│  ● Ada Chen approved Latham & Watkins bill   2 hours ago  │
│  ● Gus Silva submitted Notion bill            3 hours ago  │
│  ● ...                                                      │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

Three-tile row on desktop (`grid-cols-3 gap-4`). Stacks to single column on mobile. Greeting is simple and static — avoiding time-of-day logic keeps this deterministic across timezones and doesn't misfire at midnight edge cases.

## Server or client

The dashboard is a **Server Component** that fetches data server-side via `createCaller` (same pattern as the bill detail page). Reasons:

- No interactivity on the page itself — nothing the user can click changes dashboard state.
- Fastest possible first paint, no flash of skeleton.
- Role-dependent content (the "Needs my approval" tile) renders correctly without any client-side role-check logic that would require a loading state.

The tiles themselves are Server Components with `<Link>` children. The only client-ish thing is the hover/focus state, which CSS handles.

## The summary query

`dashboard-service.ts` exposes:

```ts
export async function getDashboardSummary(userId: string, userRole: UserRole) {
  const now = new Date();
  const in7days = addDays(now, 7);
  const in30days = addDays(now, 30);

  const [needsMyApprovalCount, dueThisWeekCount, cashOutCents, recentEvents] =
    await Promise.all([
      userRole === "APPROVER"
        ? db.bill.count({ where: { status: "PENDING_APPROVAL" } })
        : Promise.resolve(0),

      db.bill.count({
        where: {
          status: { in: ["APPROVED", "SCHEDULED", "PENDING_APPROVAL"] },
          dueDate: { lte: in7days, gte: now }, // due in next 7 days, not past due
        },
      }),

      db.bill.aggregate({
        _sum: { amountCents: true },
        where: {
          status: { in: ["APPROVED", "SCHEDULED"] },
          dueDate: { lte: in30days, gte: now },
        },
      }),

      db.billEvent.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { bill: { include: { vendor: { select: { name: true } } } } },
      }),
    ]);

  return {
    needsMyApproval: needsMyApprovalCount,
    dueThisWeek: dueThisWeekCount,
    cashOutCents: cashOutCents._sum.amountCents ?? 0,
    recentEvents,
  };
}
```

Four parallel queries via `Promise.all`. Each is cheap. The "cash out next 30 days" sums APPROVED + SCHEDULED because those are the bills that are genuinely committed to going out — DRAFT could still be deleted, PENDING_APPROVAL could be rejected.

**A design decision worth calling out:** "Due this week" counts bills in PENDING_APPROVAL + APPROVED + SCHEDULED statuses. PAID bills are excluded (they're done; not "due"). REJECTED bills excluded (terminal). Filter window is `[now, now+7days]` — not including past-due, because past-due has its own visual treatment in the inbox and the dashboard shouldn't blur the distinction between "due soon" and "overdue."

If the reader thinks "what about overdue?" — we considered adding a fourth tile. Three is the right count. Overdue bills surface visually in the inbox's Due column. Adding a fourth tile dilutes the "at a glance" value of the dashboard.

## Recent activity feed

Loads the 8 most recent `BillEvent` rows across all bills, with each event's bill and vendor eagerly included. The feed component uses the same `formatRelativeTime` helper and actor-lookup pattern from the detail page's timeline.

Each row links to `/bills/[billId]` — not to the specific event, just to the bill. The detail page's timeline is where specific event details live.

Actor names come from `trpc.user.list` (already cached from when the user switcher uses it). This keeps the Server Component from needing to join users in the query.

Wait — the service is running server-side, so it can just include user data directly:

```ts
recentEvents: await db.billEvent.findMany({
  take: 8,
  orderBy: { createdAt: 'desc' },
  include: {
    bill: { include: { vendor: { select: { name: true } } } },
  },
}),
```

Then map actor IDs to users in a follow-up batch query, or preload `db.user.findMany()` once at the top of the service. Either way the client never has to do this work.

## Tile component

```ts
// src/features/dashboard/components/summary-tile.tsx
type Props = {
  title: string;
  value: string | number;          // formatted value, ready to render
  hint?: string;                    // optional secondary line
  href?: string;                    // optional deep link
};

export function SummaryTile({ title, value, hint, href }: Props) {
  const content = (
    <div className="rounded-lg border p-6 hover:border-foreground/20 transition">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {href && <div className="mt-3 text-sm">View →</div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
```

`tabular-nums` on the value makes $ amounts visually stable across tiles — no horizontal jitter if the value changes. Small detail, signals care.

Hover treatment is subtle — border shift only, no background change. Ramp-style restraint.

## Layout on mobile

Three-column grid collapses to single column below `md`. The recent activity section stays full-width on all sizes. No mobile-specific code beyond Tailwind's responsive prefixes.

## Empty states

- Zero counts render as "0" or "$0" — the tile still exists, just shows the zero. No "nothing to do!" banner, no emoji. Ramp doesn't do that; we don't either.
- Zero recent events is possible only if the database is completely fresh (no seed). Never in practice. But the activity list renders a muted "No recent activity" as the empty branch.

## What this change does not do

- No charts or graphs. Numerical tiles only. Adding a cash-flow chart or aging-over-time graph is a flourish that the AP aging report will partially cover, and the dashboard doesn't need.
- No "quick actions" section. No "Create bill" button here — that lives in the inbox toolbar, and duplicating it on the dashboard muddles the information hierarchy.
- No filters on the recent activity feed. It's "the last 8 things that happened." Filtering it would reinvent the inbox.
- No auto-refresh. Reload the page to see updates. Real-time dashboards are a flourish that's out of scope.
- No personalization of greeting ("Good morning" vs "Good afternoon"). Static greeting.
- No widgets for aging report previews. The aging report has its own page.
