import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Bill intake — manual entry", () => {
  test("saves a manually entered bill as a DRAFT and shows it in the inbox", async ({
    page,
  }) => {
    // bill.create uses protectedProcedure — set Gus's session cookie directly
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // The page starts in "choose" mode — switch to the manual entry form
    await page.getByRole("button", { name: /enter manually/i }).click();

    // Select a vendor from the combobox
    await page.getByText("Select vendor…").click();
    await page.getByPlaceholder("Search vendors…").fill("Amazon");
    // Use exact: true so we pick the vendor item, not the "Create 'Amazon...'" footer option
    await page.getByText("Amazon Web Services", { exact: true }).click();

    // Fill invoice number (placeholder is "INV-001")
    await page.getByPlaceholder("INV-001").fill("TEST-MANUAL-001");

    // Fill bill-level amount (first number input in the form)
    await page.locator('input[type="number"]').first().fill("500");

    // Line item description and amount
    await page.getByPlaceholder("Description").first().fill("Test service");
    await page.getByPlaceholder("0.00").first().fill("500");

    // Click "Save as draft"
    await page.getByRole("button", { name: /save as draft/i }).click();

    // Wait for the bill detail page's status pill (not waitForURL which matches
    // /bills/new immediately — the status pill only exists on the detail page)
    await expect(page.getByLabel("Status: Draft")).toBeVisible({ timeout: 10_000 });
  });
});
