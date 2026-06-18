import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/studio.json";
const EMAIL = process.env.STUDIO_EMAIL || "studio@moovli.local";
const PASSWORD = process.env.STUDIO_PASSWORD || "moovli12345";

// Logs in as the studio owner via the real login form and saves the session so
// the authenticated specs don't each repeat the login flow.
setup("authenticate as studio owner", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // After sign-in the app routes to "/" → onboarded owner → /studio/dashboard.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await expect(page).toHaveURL(/\/studio\/dashboard/);

  await page.context().storageState({ path: AUTH_FILE });
});
