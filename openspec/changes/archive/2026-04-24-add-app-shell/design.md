# Design: add-app-shell

## Layout architecture

The root `layout.tsx` is a Server Component. It renders the HTML shell, loads fonts, imports global styles, and mounts two client components inside `<body>`: `<Providers>` and `<TopBar>`. `children` is rendered inside a `<main>` region below the top bar.

```
<html>
  <body>
    <Providers>                    // client: QueryClient + trpc.Provider
      <TopBar />                   // client: needs router, dropdown, cookie write
      <main>{children}</main>
    </Providers>
  </body>
</html>
```

Keeping `layout.tsx` itself a Server Component matters because it's where route-level data (like the current user) would be fetched in the future if we migrate off the cookie-based fake session. For now there's no server-side fetch in the layout — the top bar reads the current user via tRPC on the client.

## tRPC client setup

Two files for the browser side:

**`src/lib/trpc-client.ts`** — shared tRPC React hooks:

```ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/root-router";

export const trpc = createTRPCReact<AppRouter>();
```

**`src/components/providers.tsx`** — mounts QueryClient and trpc.Provider:

```ts
'use client';
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

Using `httpBatchLink` over `httpLink` so multiple `useQuery` calls on a page coalesce into one HTTP request — a meaningful perf win on the dashboard where three tiles each fire a query.

`superjson` is required because tRPC serializes Dates and BigInts through it; the server side was already configured with superjson in `add-bill-lifecycle`, and both sides must match.

## User-switching flow

The complete round trip for switching users:

1. User clicks Ada in the `<UserSwitcher>` dropdown.
2. Component POSTs to `/api/session` with `{ userId: ada.id }`.
3. Route handler writes `Set-Cookie: settle-user-id=<ada.id>; HttpOnly; Path=/; SameSite=Lax`.
4. Component calls `router.refresh()` (from `next/navigation`) to invalidate Server Component caches and re-render.
5. On the next request, the tRPC context reads the new cookie and resolves `ctx.user` to Ada. All subsequent queries reflect her role.

Why a separate `/api/session` route instead of a tRPC mutation:

- tRPC mutations don't have clean cookie-setting ergonomics — the response is a JSON payload, and threading `Set-Cookie` through requires custom tRPC response meta handling that's more code than a 12-line route handler.
- A route handler is the idiomatic Next.js way to write response headers. Same pattern real auth libraries use.
- Keeps tRPC focused on business logic, not session mechanics.

## Cookie mechanics

```
settle-user-id=<cuid>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000
```

- **HttpOnly** — not strictly necessary for a fake session, but it's how real auth cookies look and avoids setting a bad example.
- **SameSite=Lax** — safe default. Works for top-level navigation, blocks on cross-site POSTs (which we don't have).
- **No Secure flag** — so local dev works over HTTP. In production on Vercel, HTTPS is enforced at the edge regardless.
- **Max-Age 30 days** — long enough to persist across demo sessions.

No CSRF protection. Would matter for a real product; doesn't for a fake session that authorizes nothing sensitive.

## Top bar composition

```
[Logo "Settle"] [Dashboard] [Bills] [Vendors] [Reports]          [UserSwitcher]
```

Logo links to `/`. Nav links are `<Link>` components from `next/link`; active-link styling uses `usePathname()` from `next/navigation`. The primary nav is part of this shell because every subsequent page assumes it exists — hoisting it here means none of them have to reimplement it.

`<UserSwitcher>` shows the current user's name + role pill, and opens a `DropdownMenu` on click. Dropdown lists every user from `trpc.user.list.useQuery()`, each rendered as a menu item showing name and role. Selecting one calls POST `/api/session` then `router.refresh()`.

## Role-aware rendering

The top bar itself doesn't gate by role — both users see the same nav. But it exposes `trpc.user.current.useQuery()` via a lightweight hook (`useCurrentUser()`) that downstream pages can use to conditionally render UI. This is the pattern:

```ts
// src/hooks/use-current-user.ts
export function useCurrentUser() {
  const { data } = trpc.user.current.useQuery();
  return data;
}
```

Co-located under `src/hooks/` (not a feature folder) because it's genuinely cross-feature — every page that gates UI by role will use it.

## Placeholder routes

To avoid 404s when the top bar nav is clicked, this change creates minimal placeholder pages at:

- `/` — "Dashboard coming soon"
- `/bills` — "Bills inbox coming soon"
- `/vendors` — "Vendors list coming soon"
- `/reports/ap-aging` — "AP Aging Report coming soon"

Each is a one-liner Server Component. They'll be replaced wholesale by their respective changes (`add-dashboard`, `add-bill-inbox`, etc.). Having them in place now means the shell is complete and testable end-to-end — click every link, confirm no errors.

## Why not `Layout` shadcn components

shadcn has a `Sidebar` and various layout components in newer versions. Deliberately not using them here:

- They're opinionated about sidebar vs top-bar layouts. Settle is top-bar only.
- They add complexity (collapsible sidebar state, mobile drawer) the MVP doesn't need.
- A custom ~40-line top bar renders faster and reads more cleanly in review.

Using shadcn for primitives (`Button`, `DropdownMenu`, `Avatar`) — yes. Using it for layout scaffolding — no.

## What this change does not do

- No dashboard content. `/` is a placeholder until `add-dashboard`.
- No bills or vendors content. Those routes are placeholders until their feature changes.
- No role-based nav hiding. Both users see the same links. Simpler, and nothing in the nav is actually forbidden — the list query returns empty for submitters trying to see "needs my approval," which is the correct behavior, not a permission error.
- No sign-out UI. There's nothing to sign out of. The switcher is always visible.
- No theme toggle, no light/dark mode. shadcn defaults + system preference only.
- No loading states on the switcher itself. Switching is fast enough (one POST + one refresh) that a spinner would flash.
