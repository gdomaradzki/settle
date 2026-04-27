import type { Page } from "@playwright/test";

type UserRecord = { id: string; name: string; role: string };

/**
 * Sets the `settle-user-id` session cookie programmatically by fetching the
 * user list from the tRPC API and using Playwright's `addCookies` to inject
 * the cookie directly into the browser context.
 *
 * More reliable than the UI user-switcher approach because it bypasses React
 * event-handler timing issues and Next.js router cache behavior.
 */
export async function setUser(page: Page, name: string): Promise<void> {
  const resp = await page.request.get(
    "/api/trpc/user.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D",
  );
  const json = await resp.json();
  const users: UserRecord[] = json[0]?.result?.data?.json ?? [];
  const user = users.find((u) => u.name === name);
  if (!user) {
    throw new Error(`setUser: user "${name}" not found in test database`);
  }
  await page.context().addCookies([
    {
      name: "settle-user-id",
      value: user.id,
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
      httpOnly: true,
      secure: false,
    },
  ]);
}
