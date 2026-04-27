import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Vendor creation from /vendors page", () => {
  test("adds a new vendor via the dialog and it appears in the table", async ({
    page,
  }) => {
    // vendor.create uses protectedProcedure — set Gus's session cookie
    await setUser(page, "Gus Silva");

    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    // Click the "Add vendor" button
    await page.getByRole("button", { name: /add vendor/i }).click();

    // Fill the dialog
    await page.getByPlaceholder("Vendor name").fill("Stripe Inc");
    await page.getByPlaceholder("billing@vendor.com").fill("billing@stripe.com");

    // ACH is default; fill in the ACH fields
    await page.getByPlaceholder("1234").fill("9999");
    await page.getByPlaceholder("5678").fill("0260");

    // Submit
    await page.getByRole("button", { name: /create vendor/i }).click();

    // Dialog should close and the new vendor should appear in the table
    await expect(page.getByText("Stripe Inc")).toBeVisible({ timeout: 10_000 });
  });
});
