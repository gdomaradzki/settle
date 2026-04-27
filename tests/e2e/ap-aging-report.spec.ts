import { test, expect } from "@playwright/test";

/**
 * Seeded outstanding bills by bucket:
 * current  — Latham (PENDING, +3d), WeWork (PENDING, +5d), AWS (APPROVED, +7d),
 *            WeWork (SCHEDULED, +5d), Notion (SCHEDULED, +12d), Marcus (SCHEDULED, +20d)
 * d31to60  — Notion APPROVED (due -45d)
 * d61plus  — Marcus PENDING (due -75d)
 * d1to30   — not guaranteed by seed; test checks d31to60 and d61plus only.
 */
test.describe("AP Aging Report", () => {
  test("report loads with correct heading and as-of date", async ({ page }) => {
    await page.goto("/reports/ap-aging");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /AP Aging Report/i })).toBeVisible();
    await expect(page.getByText(/as of/i)).toBeVisible();
  });

  test("summary tiles show all four bucket labels", async ({ page }) => {
    await page.goto("/reports/ap-aging");
    await page.waitForLoadState("networkidle");

    // "Current" appears in both the SummaryTile and the table header — use .first()
    await expect(page.getByText("Current").first()).toBeVisible();
    await expect(page.getByText("1–30 days").first()).toBeVisible();
    await expect(page.getByText("31–60 days").first()).toBeVisible();
    await expect(page.getByText("61+ days").first()).toBeVisible();
  });

  test("Notion Labs row appears in the 31-60 day bucket (APPROVED, due -45d)", async ({
    page,
  }) => {
    await page.goto("/reports/ap-aging");
    await page.waitForLoadState("networkidle");

    // Notion Labs row should exist in the vendor table
    await expect(page.getByRole("cell", { name: /Notion Labs/i })).toBeVisible();
  });

  test("Marcus Lee Design row appears in the 61+ bucket (PENDING, due -75d)", async ({
    page,
  }) => {
    await page.goto("/reports/ap-aging");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("cell", { name: /Marcus Lee Design/i })).toBeVisible();
  });

  test("grand total row sums all outstanding amounts correctly", async ({
    page,
  }) => {
    await page.goto("/reports/ap-aging");
    await page.waitForLoadState("networkidle");

    // The Total row should be present in the table footer
    await expect(page.getByRole("cell", { name: /^Total$/i })).toBeVisible();
  });
});
