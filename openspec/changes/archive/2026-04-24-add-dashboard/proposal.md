# Change: add-dashboard

## Why

The root route `/` is still a placeholder. It's the first screen an evaluator sees when they open the deployed URL, and right now it says "Dashboard coming soon." The dashboard is the product's landing page — it answers the three questions a finance person asks every morning: "What needs my attention?" "What's going out the door this week?" "How much cash will we spend in the next 30 days?"

This change replaces the placeholder with a useful, honest dashboard that deep-links into the inbox for every surface it shows.

## What changes

- **ADDED** `src/app/page.tsx` — replaces the placeholder with the real dashboard.
- **ADDED** `src/features/dashboard/components/dashboard-view.tsx` — the page composition (greeting, tiles, activity feed).
- **ADDED** `src/features/dashboard/components/summary-tile.tsx` — reusable tile component with title, value, hint, and deep-link to a filtered inbox view.
- **ADDED** `src/features/dashboard/components/recent-activity.tsx` — a compact feed of the most recent bill events across all bills.
- **ADDED** `src/features/dashboard/dashboard-router.ts` — tRPC router exposing a `summary` query returning the three tile values and recent events.
- **ADDED** `src/features/dashboard/dashboard-service.ts` — server-only service computing the summary metrics.

## Impact

- The default URL now shows a working product surface. First-impression quality goes from "placeholder" to "shippable."
- Establishes the pattern of deep-linking dashboard tiles into filtered inbox URLs — leveraging the URL-as-state work from the inbox change.
- No schema or mutation changes. Pure read surface.
- Unblocks finishing the `openspec/specs/dashboard/` spec, which has been a declared domain since `config.yaml` but had no concrete requirements yet.

## Success criteria

- Opening `/` while signed in as Gus (SUBMITTER) shows:
  - A greeting header ("Good morning, Gus" or similar — can be static "Welcome, Gus").
  - Three summary tiles: "Needs my approval" (0 for Gus, since he's a submitter), "Due this week" (live count of bills due within 7 days), "Cash out next 30 days" (sum of scheduled + approved-but-not-yet-scheduled bill amounts due within 30 days, formatted as USD).
  - A "Recent activity" section below showing the 8 most recent bill events across all bills.
- Opening `/` while signed in as Ada (APPROVER) shows the "Needs my approval" tile with the live count of PENDING_APPROVAL bills (3 from seed).
- Each tile is clickable: "Needs my approval" links to `/bills?mine=1`; "Due this week" links to `/bills?due=this-week`; "Cash out next 30 days" is informational only — no deep link since there's no inbox filter that exactly mirrors it.
- Recent activity feed: each row shows actor avatar/initials, humanized verb ("approved Latham & Watkins bill"), relative timestamp. Clicking a row navigates to that bill's detail page.
- Empty states: if a tile has zero value, the tile still renders (just shows "0" or "$0"). If there's no recent activity, the feed shows a one-line "No recent activity" message. Neither case is visually broken.
- `npm run build` passes. Vercel deploy works.
