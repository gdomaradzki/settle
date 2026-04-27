import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Auth and roles (desktop)", () => {
  test("default session starts as Gus Silva (SUBMITTER)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").getByText("Gus Silva")).toBeVisible();
  });

  test("user switcher toggles to Ada Chen", async ({ page }) => {
    await page.goto("/");

    // Wait for the trigger to render before clicking
    const header = page.locator("header");
    await expect(header.getByText("Gus Silva")).toBeVisible();

    // Open dropdown
    await header.getByRole("button").click();

    // Wait for the session POST to complete before asserting
    const sessionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/session") && r.request().method() === "POST",
    );

    await page.getByRole("menuitem", { name: /Ada Chen/i }).click();
    await sessionResponse;

    // Header reflects the new user once user.current refetches
    await expect(header.getByText("Ada Chen")).toBeVisible({ timeout: 10_000 });
  });

  test("Approve button is hidden for SUBMITTER on a PENDING_APPROVAL bill", async ({
    page,
  }) => {
    await page.goto("/bills");

    const row = page
      .locator("tr")
      .filter({ has: page.getByLabel("Status: Pending approval") })
      .first();
    await row.click();

    await expect(page.getByRole("button", { name: /approve/i })).toBeHidden();
  });

  test("Approve button is visible for APPROVER on a PENDING_APPROVAL bill", async ({
    page,
  }) => {
    await setUser(page, "Ada Chen");
    await page.goto("/bills");

    const row = page
      .locator("tr")
      .filter({ has: page.getByLabel("Status: Pending approval") })
      .first();
    await row.click();

    await expect(page.getByRole("button", { name: /approve/i })).toBeVisible();
  });
});

test.describe("Auth and roles (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("top bar shows avatar initials only — no name text", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("header").getByText("GS")).toBeVisible();

    const nameSpan = page
      .locator("header span")
      .filter({ hasText: "Gus Silva" })
      .first();
    await expect(nameSpan).toBeHidden();
  });
});
