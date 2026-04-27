import { test, expect } from "@playwright/test";
import path from "path";
import { setUser } from "./helpers";

test.describe("CSV bulk upload", () => {
  test("uploads sample CSV, sees valid preview, confirms import, bills appear in inbox", async ({
    page,
  }) => {
    // bill.createMany uses protectedProcedure — set Gus's session cookie
    await setUser(page, "Gus Silva");

    await page.goto("/bills/upload-csv");
    await page.waitForLoadState("networkidle");

    // Upload the sample CSV
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(
      path.resolve(process.cwd(), "public/samples/bills-sample.csv"),
    );

    // Preview table should appear with 5 rows (one per CSV row)
    await expect(page.getByText("5 valid")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("0 invalid")).toBeVisible();

    // All rows should be valid since the vendors exist in the seeded DB
    const importBtn = page.getByRole("button", { name: /import 5 bills/i });
    await expect(importBtn).not.toBeDisabled();
    await importBtn.click();

    // Should redirect to bills inbox after successful import.
    // waitForURL with default waitUntil:'load' can hang on App Router client
    // navigation, so assert on the bills page heading instead.
    await expect(page.locator("h1").filter({ hasText: /^Bills$/i })).toBeVisible({
      timeout: 20_000,
    });

    // Scope to table cells — the vendor filter <select> also has an <option>
    // for "Amazon Web Services" which is hidden; we need the visible table cell.
    await expect(
      page.locator("tbody td").getByText("Amazon Web Services").first(),
    ).toBeVisible();
  });
});
