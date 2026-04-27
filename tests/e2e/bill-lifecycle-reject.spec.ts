import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Bill lifecycle — rejection", () => {
  test("PENDING_APPROVAL bill rejected by Ada shows REJECTED status and reason", async ({
    page,
  }) => {
    // ── Step 1: Create and submit an over-threshold bill as Gus ──────────────
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // The page starts in "choose" mode — switch to the manual entry form
    await page.getByRole("button", { name: /enter manually/i }).click();

    await page.getByText("Select vendor…").click();
    await page.getByPlaceholder("Search vendors…").fill("Latham");
    await page.getByText("Latham & Watkins LLP", { exact: true }).click();

    await page.getByPlaceholder("INV-001").fill("REJECT-TEST-001");

    await page.locator('input[type="number"]').first().fill("6000");

    await page.getByPlaceholder("Description").first().fill("Legal fees");
    await page.getByPlaceholder("0.00").first().fill("6000");

    await page.getByRole("button", { name: "Submit for approval" }).click();

    // Wait for the bill detail status pill (not waitForURL which matches /bills/new too)
    await expect(page.getByLabel("Status: Pending approval")).toBeVisible({
      timeout: 10_000,
    });
    const billUrl = page.url();

    // ── Step 2: Switch to Ada (APPROVER) and navigate to the bill ────────────
    await setUser(page, "Ada Chen");
    await page.goto(billUrl);
    await page.waitForLoadState("networkidle");

    // ── Step 3: Reject with a reason ─────────────────────────────────────────
    await page.getByRole("button", { name: /^Reject/ }).click();

    // Fill in the rejection reason dialog — actual placeholder is "Explain why…"
    await page.getByLabel("Rejection reason").fill("Budget not approved this quarter");
    // Click "Reject bill" scoped to the dialog so we don't hit the action-bar button
    await page.getByRole("dialog").getByRole("button", { name: /reject/i }).click();

    // ── Step 4: Assert REJECTED state ────────────────────────────────────────
    await expect(page.getByLabel("Status: Rejected")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Budget not approved this quarter", { exact: true }).first(),
    ).toBeVisible();
  });
});
