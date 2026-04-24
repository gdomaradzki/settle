# Tasks: add-app-shell

## Dependencies

- [x] Verify `@tanstack/react-query`, `@trpc/client`, `@trpc/react-query`, `superjson` are installed (should be from `add-bill-lifecycle`).
- [x] Install shadcn primitives used in this change (if not already added by a prior scaffold): `button`, `dropdown-menu`, `avatar`. Use `npx shadcn@latest add button dropdown-menu avatar`.

## tRPC client

- [x] Create `src/lib/trpc-client.ts`:
  - Exports `trpc = createTRPCReact<AppRouter>()` where `AppRouter` is imported as a type from `@/server/root-router`.
- [x] Create `src/components/providers.tsx`:
  - Client component (`'use client'` at the top).
  - Uses `useState` to memoize `QueryClient` and `trpc.createClient` instances (prevents re-creation on re-render).
  - `httpBatchLink` pointing at `/api/trpc`, transformer `superjson`.
  - Wraps children in both `trpc.Provider` and `QueryClientProvider`.

## Users domain — router

- [x] Create `src/features/users/user-router.ts`:
  - `import 'server-only';`
  - `list` query: returns all users ordered by name, selecting `id`, `name`, `email`, `role` only.
  - `current` query: returns `ctx.user` from the tRPC context.
- [x] Register `userRouter` under `users` in `src/server/root-router.ts`.

## Session route handler

- [x] Create `src/app/api/session/route.ts`:
  - Exports `POST` handler that parses `{ userId: string }` from the request body.
  - Validates with zod.
  - Verifies the user exists in the DB (load via Prisma). Returns 404 if not found.
  - Writes `Set-Cookie: settle-user-id=<userId>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`.
  - Returns `{ ok: true }`.

## Root layout

- [x] Edit `src/app/layout.tsx` (the Next.js scaffold version):
  - Remains a Server Component.
  - Imports global styles.
  - Sets up fonts (Inter or whatever the scaffold used; keep it).
  - Sets `<html lang="en">` and body classes for the font and default Tailwind styling.
  - Wraps body content in `<Providers>`.
  - Renders `<TopBar />` above `<main className="...">{children}</main>`.
  - Sets `metadata` export: `title = "Settle"`, `description = "Bill pay workflow for modern finance teams"`.

## Top bar and switcher

- [x] Create `src/components/top-bar.tsx`:
  - Client component.
  - Left: Settle logo/wordmark (text only; link to `/`).
  - Center: nav links to `/`, `/bills`, `/vendors`, `/reports/ap-aging`.
  - Uses `usePathname()` for active-link styling.
  - Right: `<UserSwitcher />`.
  - Tailwind: `sticky top-0 z-40` bar with border-bottom, flex row, padded. Height ~56px.
- [x] Create `src/components/user-switcher.tsx`:
  - Client component.
  - Uses `trpc.user.current.useQuery()` and `trpc.user.list.useQuery()`.
  - Shows loading skeleton until both resolve.
  - Renders `<DropdownMenu>` trigger as the current user's name + role pill.
  - Dropdown content lists each user with their name and role; selecting one:
    - POSTs to `/api/session` with `{ userId: chosenUser.id }`.
    - On success, calls `router.refresh()` from `next/navigation`.
    - On failure, logs to console (no toast in this change).

## Hook

- [x] Create `src/hooks/use-current-user.ts`:
  - Exports `useCurrentUser()` that wraps `trpc.user.current.useQuery()` and returns `data`.
  - Kebab-case filename, named export only.

## Placeholder routes

Each of the following routes renders a minimal Server Component page with a centered heading like "Dashboard coming soon." Small enough to not warrant files of their own, but the routes must exist so top-bar nav doesn't 404.

- [x] Edit `src/app/page.tsx`: "Dashboard coming soon"
- [x] Create `src/app/bills/page.tsx`: "Bills inbox coming soon"
- [x] Create `src/app/vendors/page.tsx`: "Vendors coming soon"
- [x] Create `src/app/reports/ap-aging/page.tsx`: "AP Aging Report coming soon"

## Verification

- [x] `npm run build` passes with no TypeScript errors.
- [x] `npm run dev` boots. Open `http://localhost:3000`:
  - [x] Top bar is visible with Settle logo, four nav links, and the user switcher showing Gus.
  - [x] Click each nav link; each route renders its placeholder without 404 or error.
- [x] Click the user switcher:
  - [x] Dropdown opens showing Gus (SUBMITTER) and Ada (APPROVER).
  - [x] Click Ada.
  - [x] Page refreshes. Top bar now shows Ada as current user.
- [x] Open DevTools → Application → Cookies. Confirm `settle-user-id` cookie is present, HttpOnly, Lax.
- [x] Restart the dev server (`Ctrl+C`, `npm run dev` again). Open the page. Confirm the top bar still shows Ada (cookie persisted).
- [x] Switch back to Gus to leave a clean state for the next change.
- [x] Deploy to Vercel (`vercel --prod`). Confirm the live URL renders the shell with top bar and switcher working.

## Definition of done

- All checkboxes above are ticked.
- The shell is demo-ready: an interviewer could open the deployed URL, switch users, and click every nav link without hitting an error or a 404. Placeholder pages say "coming soon" — not empty, not broken.
- `openspec validate --strict add-app-shell` passes.
