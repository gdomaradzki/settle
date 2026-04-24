# Tasks: add-dashboard

## Dependencies

- [x] No new packages required. Verify `date-fns` is NOT installed if the prior `formatRelativeTime` helper was hand-rolled (avoid duplicating).

## Service

- [x] Create `src/features/dashboard/dashboard-service.ts`:
  - `import 'server-only';`
  - Exports `getDashboardSummary(userId: string, userRole: UserRole)` that returns `{ needsMyApproval: number; dueThisWeek: number; cashOutCents: number; recentEvents: ActivityEvent[] }`.
  - Four queries running in parallel via `Promise.all`:
    1. Count of PENDING_APPROVAL bills — returned as 0 for non-APPROVER roles without hitting the DB.
    2. Count of bills in PENDING_APPROVAL, APPROVED, or SCHEDULED where `dueDate` is between now and now+7 days inclusive.
    3. Sum of `amountCents` across APPROVED + SCHEDULED bills where `dueDate` between now and now+30 days.
    4. The 8 most recent `BillEvent` rows ordered by `createdAt` desc, including related bill and vendor name.
  - Preload users via one `db.user.findMany()` and map actor IDs on the events before returning.

## Router

- [x] Create `src/features/dashboard/dashboard-router.ts`:
  - `import 'server-only';`
  - `summary` public query: delegates to `getDashboardSummary(ctx.user.id, ctx.user.role)`.
- [x] Register `dashboardRouter` under `dashboard` in `src/server/root-router.ts`.

## Tile component

- [x] Create `src/features/dashboard/components/summary-tile.tsx`:
  - Props: `{ title: string; value: string | number; hint?: string; href?: string; }`.
  - Renders a bordered card with title (muted), value (large, `tabular-nums`), optional hint line, and "View →" footer when `href` is set.
  - Wraps content in `<Link>` when `href` is provided.
  - Subtle hover: border color shift, no background fill change.
  - Named export only.

## Recent activity component

- [x] Create `src/features/dashboard/components/recent-activity.tsx`:
  - Server Component — accepts events array as props.
  - Props: `{ events: ActivityEvent[] }`.
  - Each row: small avatar/initials badge, "{actorName} {humanized verb} {vendor name} bill", muted relative time.
  - Row is a `<Link>` to `/bills/[billId]`.
  - Empty state: "No recent activity" in muted text.
  - Humanize verb same as detail-page timeline: created, submitted, approved, rejected, scheduled, paid, edited.

## Dashboard composition

- [x] Create `src/features/dashboard/components/dashboard-view.tsx`:
  - Server Component.
  - Props: `{ summary: DashboardSummary; userName: string; }`.
  - Renders greeting, three tiles in a responsive grid, recent activity below.
  - Tile config:
    - Tile 1: "Needs my approval", value = `summary.needsMyApproval`, href = `/bills?mine=1`.
    - Tile 2: "Due this week", value = `summary.dueThisWeek`, href = `/bills?due=this-week`.
    - Tile 3: "Cash out next 30 days", value = `formatUSD(summary.cashOutCents)`, no href.

## Page

- [x] Replace `src/app/page.tsx` (currently a placeholder):
  - Server Component.
  - Uses `createCaller` with the cookies-based context factory to fetch `dashboard.summary`.
  - Also fetches `users.current` for the greeting name.
  - Renders `<DashboardView summary={...} userName={...} />`.
  - `metadata.title = 'Dashboard — Settle'`.

## Verification

- [x] `npm run build` passes.
- [x] As Gus (SUBMITTER) on `/`:
  - [x] Greeting reads "Welcome, Gus" (or similar).
  - [x] "Needs my approval" shows `0`.
  - [x] "Due this week" shows a number matching the seed (varies based on seed dates).
  - [x] "Cash out next 30 days" shows a dollar amount summing the APPROVED + SCHEDULED bills due in the next 30 days.
  - [x] Recent activity lists 8 most recent events across all bills, newest first.
- [x] Switch to Ada (APPROVER):
  - [x] "Needs my approval" now shows `3` (or however many PENDING_APPROVAL bills exist after your testing).
  - [x] Other tiles unchanged.
- [x] Click "Needs my approval" tile — navigates to `/bills?mine=1`.
- [x] Click "Due this week" tile — navigates to `/bills?due=this-week`.
- [x] Click a row in recent activity — navigates to that bill's detail page.
- [x] Empty states:
  - [x] Re-seed the DB so everything is fresh. Confirm all tiles render values (not "undefined" or "NaN").
- [x] Responsive check at 768px: tiles stack to single column without overlap or overflow.
- [x] Deploy to Vercel. Walk the flow on the live URL.

## Definition of done

- All checkboxes above are ticked.
- The landing page is useful information — not decoration.
- Every tile and activity row deep-links somewhere useful.
- `openspec validate --strict add-dashboard` passes.
