import { test, expect } from "@playwright/test";

// Impersonation needs a platform-admin account. Provide ADMIN_EMAIL/ADMIN_PASSWORD
// to run it; otherwise it's skipped (the studio-owner storageState can't reach it).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("admin view-as-studio impersonation", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "set ADMIN_EMAIL/ADMIN_PASSWORD to run");

  test("admin opens a studio dashboard and can exit", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL!);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });

    await page.goto("/admin/studios", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Row actions" }).first().click();
    await page.getByRole("menuitem", { name: /Open dashboard/ }).click();

    await expect(page).toHaveURL(/\/studio\/dashboard/);
    await expect(page.getByText(/Viewing .* as admin/)).toBeVisible();

    await page.getByRole("button", { name: "Exit" }).click();
    await expect(page).toHaveURL(/\/admin\/studios/);
  });
});
