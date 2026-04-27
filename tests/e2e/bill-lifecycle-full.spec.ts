import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

/**
 * Full happy-path lifecycle:
 * Gus creates over-threshold bill → submits → Ada approves → Gus schedules → Gus pays
 * Timeline shows 5 events (created, submitted, approved, scheduled, paid).
 */
test.describe("Bill lifecycle — full (submit → approve → schedule → pay)", () => {
  test("runs the complete lifecycle and shows 5 timeline events", async ({
    page,
  }) => {
    // ── Create + submit as Gus ────────────────────────────────────────────────
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // The page starts in "choose" mode — switch to the manual entry form
    await page.getByRole("button", { name: /enter manually/i }).click();

    await page.getByText("Select vendor…").click();
    await page.getByPlaceholder("Search vendors…").fill("WeWork");
    // Use exact: true so we pick the vendor item, not the "Create 'WeWork'" footer option
    await page.getByText("WeWork", { exact: true }).click();

    await page.getByPlaceholder("INV-001").fill("LIFECYCLE-FULL-001");

    // $6,000 — above the $5,000 threshold
    await page.locator('input[type="number"]').first().fill("6000");

    await page.getByPlaceholder("Description").first().fill("Office rent");
    await page.getByPlaceholder("0.00").first().fill("6000");

    await page.getByRole("button", { name: "Submit for approval" }).click();

    // Wait for the bill detail status pill (not waitForURL which matches /bills/new too)
    await expect(page.getByLabel("Status: Pending approval")).toBeVisible({
      timeout: 10_000,
    });
    const billUrl = page.url();

    // ── Switch to Ada and approve ─────────────────────────────────────────────
    await setUser(page, "Ada Chen");
    await page.goto(billUrl);
    await page.waitForLoadState("networkidle");

    // Use /^Approve/ so we match "Approve A" (the action button) but not
    // "AC Ada Chen Approver" (the user switcher button)
    await page.getByRole("button", { name: /^Approve/ }).click();
    await expect(page.getByLabel("Status: Approved")).toBeVisible({ timeout: 10_000 });

    // ── Switch back to Gus and schedule ──────────────────────────────────────
    await setUser(page, "Gus Silva");
    await page.goto(billUrl);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /schedule/i }).click();

    // Schedule dialog — pick a pay date (accept default if pre-filled) and confirm
    const scheduleBtn = page
      .getByRole("button", { name: /schedule payment|confirm/i })
      .last();
    await scheduleBtn.click();

    await expect(page.getByLabel("Status: Scheduled")).toBeVisible({ timeout: 10_000 });

    // ── Pay ───────────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /send payment/i }).click();
    await expect(page.getByLabel("Status: Paid")).toBeVisible({ timeout: 10_000 });

    // ── Verify timeline has exactly 5 events ─────────────────────────────────
    // Timeline events: created, submitted, approved, scheduled, paid
    const timelineItems = page
      .locator("li")
      .filter({ hasText: /created|submitted|approved|scheduled|paid/i });
    await expect(timelineItems).toHaveCount(5, { timeout: 10_000 });
  });
});
