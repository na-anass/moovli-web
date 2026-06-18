import { test, expect } from "@playwright/test";

// Public booking page — no auth.
test.use({ storageState: { cookies: [], origins: [] } });

const SLUG = process.env.E2E_STUDIO_SLUG || "the-pilates-studio-morocco";

test.describe("public booking page", () => {
  test("renders the filter controls", async ({ page }) => {
    // domcontentloaded — the studio logo/cover point at remote URLs whose
    // load event can hang the default wait.
    await page.goto(`/booking/${SLUG}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This week" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Available only" })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by class/)).toBeVisible();
  });
});
