import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

// ─── Desktop ──────────────────────────────────────────────────────────────────

test.describe("Auth and roles (desktop)", () => {
  test("default session starts as Gus Silva (SUBMITTER)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // User switcher in top bar shows the current user's name
    await expect(page.locator("header").getByText("Gus Silva")).toBeVisible();
  });

  test("user switcher toggles to Ada Chen", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open the dropdown
    const trigger = page.locator("header").getByText("Gus Silva");
    await trigger.click();

    // Pick Ada Chen from the dropdown
    await page.getByRole("menuitem", { name: /Ada Chen/i }).click();
    await page.waitForLoadState("networkidle");

    // Force a fresh page load so the server re-renders with Ada's cookie
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("header").getByText("Ada Chen")).toBeVisible();
  });

  test("Approve button is hidden for SUBMITTER on a PENDING_APPROVAL bill", async ({
    page,
  }) => {
    await page.goto("/bills");
    await page.waitForLoadState("networkidle");

    // Click the first table row containing a PENDING_APPROVAL status pill
    const row = page
      .locator("tr")
      .filter({ has: page.getByLabel("Status: Pending approval") })
      .first();
    await row.click();
    await page.waitForLoadState("networkidle");

    // Gus (SUBMITTER) should NOT see the Approve button
    await expect(page.getByRole("button", { name: /approve/i })).not.toBeVisible();
  });

  test("Approve button is visible for APPROVER on a PENDING_APPROVAL bill", async ({
    page,
  }) => {
    // Set Ada's session cookie directly — more reliable than the UI switcher
    // because it bypasses React event-handler timing and Next.js router cache.
    await setUser(page, "Ada Chen");

    await page.goto("/bills");
    await page.waitForLoadState("networkidle");

    // Click the first table row containing a PENDING_APPROVAL status pill
    const row = page
      .locator("tr")
      .filter({ has: page.getByLabel("Status: Pending approval") })
      .first();
    await row.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /approve/i })).toBeVisible();
  });
});

// ─── Mobile viewport ──────────────────────────────────────────────────────────

test.describe("Auth and roles (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("top bar shows avatar initials only — no name text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // On mobile the name span is hidden via CSS (hidden sm:flex)
    // The avatar fallback "GS" should be visible in the header button; the full name should not be
    await expect(page.locator("header").getByText("GS")).toBeVisible();
    // The "Gus Silva" text is inside a span with class "hidden sm:flex".
    // Use .first() to pick the outer wrapper span (the one with display:none on mobile).
    const nameSpan = page.locator("header span").filter({ hasText: "Gus Silva" }).first();
    await expect(nameSpan).toBeHidden();
  });
});
