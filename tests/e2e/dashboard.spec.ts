import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Dashboard", () => {
  test("tiles render with values from seeded data (as Ada — APPROVER)", async ({
    page,
  }) => {
    // Set Ada's session cookie directly so the server renders with her context
    await setUser(page, "Ada Chen");

    // Navigate to "/" with Ada's cookie so the server component renders Ada's summary
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // "Needs my approval" should show the count of PENDING_APPROVAL bills (≥ 3 from seed)
    const needsApproval = page.getByText("Needs my approval").locator("..");
    await expect(needsApproval).toBeVisible();

    // The tile value should be a positive integer
    const value = page.locator("p").filter({ hasText: /^\d+$/ }).first();
    await expect(value).toBeVisible();
    const text = await value.textContent();
    expect(Number(text)).toBeGreaterThanOrEqual(3);
  });

  test("clicking 'Needs my approval' tile navigates to filtered inbox", async ({
    page,
  }) => {
    // Switch to Ada via UI (just needs the link to be clickable, not the server count)
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const trigger = page.locator("header").getByText("Gus Silva");
    await trigger.click();
    await page.getByRole("menuitem", { name: /Ada Chen/i }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: /needs my approval/i }).click();
    await page.waitForURL(/\/bills\?mine=1/);
    await page.waitForLoadState("networkidle");

    // Should only show PENDING_APPROVAL bills
    const statusPills = page.getByText("Pending approval");
    await expect(statusPills.first()).toBeVisible();
  });

  test("'Cash out' tile shows a dollar amount", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Cash out tile shows formatted USD — match the dollar sign
    await expect(page.getByText(/\$[\d,]+\.\d{2}/).first()).toBeVisible();
  });
});
