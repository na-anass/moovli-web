import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite. Runs against the local stack (web :3001 + API :3000 + local
 * Supabase). Assumes the dev server is already up; reuses it if so.
 *
 * Auth: the `setup` project logs in once as the studio owner and saves a
 * storageState the authenticated specs reuse. Public specs (booking page)
 * override storageState to run signed-out.
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/studio.json" },
      dependencies: ["setup"],
    },
  ],
});
