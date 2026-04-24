# Change: add-app-shell

## Why

The backend is complete and verifiable, but there's no way for a user to interact with it. Every UI change downstream — inbox, detail, intake, dashboard — needs a host: a root layout, a top bar, a navigation structure, a tRPC client on the browser, and a user-switching mechanism that makes the approval handoff demonstrable.

This change builds that host and nothing else. No feature pages yet. After this lands, the app has a functional chrome with nothing inside it — but the chrome is correct, and subsequent changes can focus entirely on their own content.

## What changes

- **ADDED** `src/app/layout.tsx` — root HTML shell, global styles, font setup, tRPC/React Query provider, top bar.
- **ADDED** `src/app/page.tsx` — a placeholder dashboard route. Renders a minimal "Dashboard coming soon" block for now; replaced by `add-dashboard` later.
- **ADDED** `src/components/top-bar.tsx` — logo, primary nav, user switcher on the right.
- **ADDED** `src/components/user-switcher.tsx` — dropdown listing seeded users; selecting one writes the `settle-user-id` cookie and refreshes the session.
- **ADDED** `src/app/api/session/route.ts` — POST handler that writes the `settle-user-id` cookie given a user ID.
- **ADDED** `src/features/users/user-router.ts` — tRPC router exposing `list` (for the switcher) and `current` (for the top bar's current-user display).
- **ADDED** `src/lib/trpc-client.ts` — browser-side tRPC client factory (`createTRPCReact<AppRouter>`).
- **ADDED** `src/components/providers.tsx` — client component wrapping children in `QueryClientProvider` and `trpc.Provider`.
- **ADDED** shadcn primitives needed for this shell: `Button`, `DropdownMenu`, `Avatar` (if not already installed by the scaffold).

## Impact

- Unblocks every UI change after this. The inbox, detail, intake, and dashboard routes all mount inside the layout and depend on the tRPC provider being in place.
- The approval handoff becomes demonstrable: switch from Gus → Ada → Gus in the top bar and watch permissions / list contents change accordingly.
- No business logic changes. No new DB columns, no new status transitions.

## Success criteria

- `npm run dev` boots and `/` renders the top bar with the seeded SUBMITTER (Gus) as the current user by default.
- The user switcher opens a dropdown listing both seeded users with their roles visible.
- Selecting Ada triggers a cookie write and a page refresh; the top bar now shows Ada as the current user.
- The top bar's primary nav contains links to `/`, `/bills`, `/vendors`, and `/reports/ap-aging`. All four routes resolve (to placeholder pages) without 404s.
- `npm run build` passes with no TypeScript errors.
- Deploying to Vercel still works; production URL loads the shell.
- The tRPC provider is wired such that a later `useQuery(trpc.bill.list.queryOptions({}))` would work without further setup.