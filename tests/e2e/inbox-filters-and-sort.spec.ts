import { test, expect } from "@playwright/test";

test.describe("Inbox filters and sort (desktop)", () => {
  test("clicking the Draft status radio filters to DRAFT bills and updates the URL", async ({
    page,
  }) => {
    await page.goto("/bills");
    await page.waitForLoadState("networkidle");

    // Filter sidebar is visible on desktop; click the Draft radio
    await page.getByLabel("Draft").first().click();

    // URL should reflect the filter
    await expect(page).toHaveURL(/status=DRAFT/);
    await page.waitForLoadState("networkidle");

    // All visible status pills should be "Draft"
    await expect(page.getByLabel("Status: Draft").first()).toBeVisible();

    // No "Pending approval" STATUS PILLS should be visible (the sidebar radio label is still
    // visible, so scope to the actual pill aria-label)
    await expect(page.getByLabel("Status: Pending approval")).not.toBeVisible();
  });

  test("'Any vendor' select removes vendor filter from URL", async ({ page }) => {
    // Start with a vendor filter applied
    await page.goto("/bills?vendor=nonexistent");
    await page.waitForLoadState("networkidle");

    // Change vendor select to "Any vendor"
    await page.getByRole("combobox").selectOption("");
    await expect(page).not.toHaveURL(/vendor=/);
  });

  test("search input updates URL with q param", async ({ page }) => {
    await page.goto("/bills");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder(/search/i).fill("AWS");
    await expect(page).toHaveURL(/q=AWS/, { timeout: 5_000 });
  });
});

test.describe("Inbox filters (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile Filters button opens the filter sheet", async ({ page }) => {
    await page.goto("/bills");
    await page.waitForLoadState("networkidle");

    // On mobile, the sidebar is hidden; a "Filters" button appears instead
    const filtersBtn = page.getByRole("button", { name: /filters/i });
    await expect(filtersBtn).toBeVisible();
    await filtersBtn.click();

    // The sheet should appear containing the status radio buttons
    // "Draft" appears in both the filter sheet and as status pills; scope to the sheet
    await expect(page.getByRole("dialog").getByText("Draft")).toBeVisible();
  });
});
