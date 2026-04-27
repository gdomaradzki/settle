import { test, expect } from "@playwright/test";
import { setUser } from "./helpers";

test.describe("Vendor creation inline from bill intake", () => {
  test("creates a new vendor from the combobox and it auto-selects on the form", async ({
    page,
  }) => {
    // vendor.create uses protectedProcedure — set Gus's session cookie
    await setUser(page, "Gus Silva");

    await page.goto("/bills/new");
    await page.waitForLoadState("networkidle");

    // The page starts in "choose" mode — switch to the manual entry form
    await page.getByRole("button", { name: /enter manually/i }).click();

    // Open the vendor combobox
    await page.getByText("Select vendor…").click();

    // Search for a vendor that doesn't exist yet
    await page.getByPlaceholder("Search vendors…").fill("Figma");

    // The "Create Figma" option should appear at the bottom
    await expect(page.getByText(/create "Figma"/i)).toBeVisible();
    await page.getByText(/create "Figma"/i).click();

    // The "New vendor" dialog opens with "Figma" pre-filled
    await expect(page.getByPlaceholder("Vendor name")).toHaveValue("Figma");

    // Submit the dialog
    await page.getByRole("button", { name: /create vendor/i }).click();

    // The combobox should now show "Figma" as the selected vendor
    // Use .first() in case the dialog is still animating out
    await expect(page.getByText("Figma").first()).toBeVisible({ timeout: 10_000 });
    // The dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
