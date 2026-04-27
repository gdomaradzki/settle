import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

// Bills below $5,000 (500,000 cents) auto-approve on submit — no approver needed.

test.describe("Bill lifecycle — auto-approve (under threshold)", () => {
  test("submitting an under-threshold bill skips approval and lands on APPROVED", async ({
    page,
  }) => {
    // bill mutations use protectedProcedure — set Gus's session cookie
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // The page starts in "choose" mode — switch to the manual entry form
    await page.getByRole("button", { name: /enter manually/i }).click();

    // Select vendor
    await page.getByText("Select vendor…").click();
    await page.getByPlaceholder("Search vendors…").fill("Notion");
    await page.getByText("Notion Labs", { exact: true }).click();

    // Fill invoice details — amount well below $5,000
    await page.getByPlaceholder("INV-001").fill("AUTO-APPROVE-001");

    // Set bill-level amount: $100
    await page.locator('input[type="number"]').first().fill("100");

    // Line item
    await page.getByPlaceholder("Description").first().fill("Small service");
    await page.getByPlaceholder("0.00").first().fill("100");

    // Submit (not just save as draft)
    await page.getByRole("button", { name: "Submit for approval" }).click();

    // Wait for the bill detail status pill — APPROVED because amount < threshold
    await expect(page.getByLabel("Status: Approved")).toBeVisible({ timeout: 10_000 });
  });
});
