import { test, expect } from "@playwright/test";
import path from "path";
import { setUser } from "./helpers";

// ANTHROPIC_API_KEY is intentionally unset in CI — the canned-extraction path
// is exercised end-to-end (aws-invoice.pdf → "Amazon Web Services" extraction).

test.describe("Bill intake — PDF upload", () => {
  test("uploads aws-invoice.pdf, fills form from canned extraction, submits", async ({
    page,
  }) => {
    // intake.extractFromPdf uses protectedProcedure — set Gus's session cookie
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // Locate the file input inside the PDF uploader area
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(
      path.resolve(process.cwd(), "public/samples/aws-invoice.pdf"),
    );

    // Wait for the canned extraction to populate the vendor combobox
    await expect(page.getByText("Amazon Web Services").first()).toBeVisible({
      timeout: 10_000,
    });

    // The form should be pre-filled; submit it
    await page.getByRole("button", { name: "Submit for approval" }).click();

    // Wait for the bill detail status pill (avoids matching /bills/new in the URL)
    await expect(page.getByLabel(/Status:/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Amazon Web Services/i).first()).toBeVisible();
  });
});
