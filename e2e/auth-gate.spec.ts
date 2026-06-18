import { test, expect } from "@playwright/test";

test.describe("auth gate", () => {
  test("owner entry resolves to the studio dashboard (no login bounce)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/studio\/dashboard/);
    // Sidebar nav renders → the studio chrome (not a flash of something else).
    await expect(page.getByRole("link", { name: "Schedule", exact: true })).toBeVisible();
  });

  test("unauthenticated protected route redirects to login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/studio/schedule", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});
