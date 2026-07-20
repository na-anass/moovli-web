import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Full direct-channel booking flow (Spec C):
 *   guest reserves on the public page  →  QR ticket rendered
 *   studio scans the code on /studio/bookings  →  confirmed + checked in
 *
 * Exercises the pieces added for the direct-channel completion work:
 *   - guest booking form + QR confirmation (P0-B)
 *   - studio scan-to-confirm-and-check-in box (P0-B)
 *   - booking search by reference (P2-B)
 *
 * Requires the local stack (web :3001 + API :3000 + seeded Supabase) — run
 * `psql -f moovli-api/database/seed-demo.sql` first so a bookable direct
 * session exists. The guest booking is created via the real UI; the POST is a
 * guest booking regardless of the browser's auth state.
 */

const API_URL = process.env.E2E_API_URL || "http://localhost:3000";
const SLUG = process.env.E2E_STUDIO_SLUG || "the-pilates-studio-morocco";

// Resolve a bookable future session for the studio's direct_hosted channel.
async function findBookableSession(api: APIRequestContext) {
  const entityRes = await api.get(`${API_URL}/api/entities/slug/${SLUG}`);
  expect(entityRes.ok(), "entity lookup").toBeTruthy();
  const entityId = (await entityRes.json()).data.id as string;

  const chRes = await api.get(`${API_URL}/api/channels/entity/${entityId}`);
  expect(chRes.ok(), "channel lookup").toBeTruthy();
  const channels = (await chRes.json()).data as Array<{ id: string; type: string }>;
  const direct = channels.find((c) => c.type === "direct_hosted");
  expect(direct, "direct_hosted channel exists").toBeTruthy();

  const startAfter = new Date(Date.now() + 2 * 3600_000).toISOString();
  const sesRes = await api.get(
    `${API_URL}/api/channels/${direct!.id}/sessions?startAfter=${startAfter}&limit=20`,
  );
  expect(sesRes.ok(), "sessions lookup").toBeTruthy();
  const sessions = (await sesRes.json()).data as Array<{ id?: string; session_id?: string }>;
  expect(sessions.length, "at least one bookable future session (seed-demo.sql)").toBeGreaterThan(0);
  // Spread picks across runs so repeated runs don't hammer one session's capacity.
  const pick = sessions[Date.now() % sessions.length];
  return { sessionId: (pick.id || pick.session_id) as string };
}

test.describe("direct-channel booking flow", () => {
  test("guest reserves → gets QR → studio scans → checked in", async ({ page, request }) => {
    const { sessionId } = await findBookableSession(request);

    const stamp = Date.now();
    const guestName = `E2E Flow ${stamp}`;
    const guestEmail = `e2e.flow.${stamp}@example.com`;

    // --- 1. Guest books on the public session page (signed-out-equivalent) ---
    await page.goto(`/booking/${SLUG}/session/${sessionId}`, { waitUntil: "domcontentloaded" });

    await page.getByPlaceholder("Karima Tazi").fill(guestName);
    await page.locator('input[type="email"]').fill(guestEmail);

    const [bookingResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/bookings") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: /Reserve/ }).click(),
    ]);
    expect(bookingResp.ok(), "booking POST succeeds").toBeTruthy();
    const code = (await bookingResp.json()).data.qrCode as string;
    expect(code).toMatch(/^BK-/);

    // --- 2. Confirmation screen shows the QR + reference ---
    await expect(page.getByText("Reservation received")).toBeVisible();
    await expect(page.locator("svg").first()).toBeVisible(); // QR code
    await expect(page.getByText(code)).toBeVisible();

    // --- 3. Studio scans the code on /studio/bookings → confirm + check in ---
    await page.goto("/studio/bookings", { waitUntil: "domcontentloaded" });
    const scanForm = page
      .locator("form")
      .filter({ has: page.getByPlaceholder(/Scan or type booking code/) });
    await scanForm.getByPlaceholder(/Scan or type booking code/).fill(code);
    await scanForm.getByRole("button", { name: "Check in" }).click();

    // Success banner reads "Checked in · <code>"
    await expect(page.getByText(new RegExp(`Checked in.*${code}`))).toBeVisible();

    // --- 4. Search finds the now-checked-in booking by guest name ---
    await page.getByPlaceholder(/Search by reference/).fill(guestName);
    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText("Checked in").last()).toBeVisible();
  });
});
