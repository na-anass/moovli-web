import { test, expect } from "@playwright/test";

test.describe("studio dashboard surfaces", () => {
  test("schedule page shows the lifecycle/status filters + New Session", async ({ page }) => {
    await page.goto("/studio/schedule", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/of \d+ shown/)).toBeVisible();
    await expect(page.getByRole("button", { name: "New Session" })).toBeVisible();
  });

  test("settings has the photo gallery with upload", async ({ page }) => {
    await page.goto("/studio/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Photo gallery")).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload photo/ })).toBeVisible();
  });

  test("marketplace markup slider enforces the 20% floor", async ({ page }) => {
    await page.goto("/studio/channels/marketplace", { waitUntil: "domcontentloaded" });
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("min", "20");
  });
});
