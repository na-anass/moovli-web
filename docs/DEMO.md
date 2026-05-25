# Moovli v2 — Team Demo Scenarios

End-to-end walkthroughs for presenting the new studio + direct-booking flow to
the team. Focus is on **direct booking** (a studio's own public page where
guests reserve without going through the marketplace).

---

## Prerequisites — bring the stack up

```bash
# Terminal 1: local Supabase
cd moovli-api
supabase start

# Terminal 2: API
cd moovli-api
npm run dev                # → http://localhost:3000

# Terminal 3: Web
cd moovli-web
npm run dev                # → http://localhost:3001
```

Studio owner credentials (used by both scenarios):

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `studio@moovli.local`       |
| Password | `moovli12345`               |
| Studio   | The Pilates Studio Morocco  |
| Slug     | `the-pilates-studio-morocco` |

Public booking page (no auth):
**`http://localhost:3001/booking/the-pilates-studio-morocco`**

---

## Seed scripts

Two SQL scripts in `moovli-api/database/` reset the studio between demo modes:

| Script                            | What it does                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed-demo.sql`                   | "Ready studio" — 4 services across pilates/yoga/HIIT/barre, ~28 sessions across the next 7 days, brand color set, channels enabled, bookings cleared.   |
| `seed-reset-onboarding.sql`       | "Brand-new studio" — clears services + sessions + brand + plan + payout method and NULLs `entities.onboarded_at` so the wizard triggers on next login.  |

Run either with:

```bash
cd moovli-api
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f database/seed-demo.sql
```

Both scripts are **idempotent** — safe to re-run between demos.

---

## Scenario A — Onboarding wizard (first-run flow)

**Setup:** run `seed-reset-onboarding.sql` first.

**What you're demoing:** the moment a new studio finishes signup, they get
walked through 6 steps to be productive in under 5 minutes. Every step is
skippable; progress is saved on each "Continue".

### Walkthrough

1. **Log in** at `http://localhost:3001/login` with `studio@moovli.local` / `moovli12345`.
2. You land on `/studio/dashboard` — the dashboard detects `onboarded_at IS NULL` and immediately redirects to `/studio/onboarding`.

**Step 1 — Welcome**
Shows the 4 things they'll set up. Click **Get started**.

**Step 2 — Brand color**
Color picker + 8 presets + live preview of a session card. Pick magenta `#D946EF` (matches studio brand). Click **Continue**.

**Step 3 — First service**
Form with category dropdown, duration, capacity, price. Try:
- Name: `Megaformer Pilates`
- Category: Pilates
- Duration: 50, Capacity: 12, Price: 200 MAD
- Short description: "Megaformer reformer class"

Click **Create & continue** — service is saved.

**Step 4 — Plan**
Two cards side-by-side. **300 MAD Standard** vs **250 MAD Marketplace + 15% markup**.
- Click **Start trial** on either → opens Stripe Checkout (use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC)
- OR click **Decide later** to skip — they can subscribe from `/studio/billing` anytime

**Step 5 — First session**
Date/time + capacity + price (auto-filled from the service). Per-channel publish toggles for Marketplace + Direct. Click **Create & continue**.

**Step 6 — Payouts** (optional)
IBAN form. Click **Skip — I'll add later** to demonstrate the skip path.

**Step 7 — Done!**
Recap of what got configured. Click **Go to dashboard** — this calls `POST /api/studio/:entityId/onboarding/complete` to stamp `onboarded_at`, then redirects to the dashboard. The wizard will not trigger again.

### What to highlight to the team

- **Resumable**: every step writes immediately, so closing the tab and coming back keeps progress
- **Skippable**: any step can be deferred without blocking
- **Auto-prefill**: capacity + price prefill from the service in step 5, no re-typing
- **Plan card defaults to Marketplace as "Most popular"** — gentle steering toward the higher-conversion path
- **First-run gate** is at the dashboard, not on every page — once they finish, the wizard never appears

---

## Scenario B — Direct booking, end-to-end

**Setup:** run `seed-demo.sql`. Studio is "ready" with services + sessions.

**What you're demoing:** a guest discovers the studio's public booking page,
reserves a session without signing up, and the studio confirms it from their
inbox. Direct bookings never touch the marketplace — payment happens at the
studio, Moovli takes 0%.

### Part 1 — Public booking page (guest perspective)

1. Open `http://localhost:3001/booking/the-pilates-studio-morocco` (no auth needed — middleware bypasses it for `/booking/` paths).

2. **Studio header**: name, short description, brand color accents (magenta).

3. **List view (default)** — shows all sessions for the next 30 days. Switch to **Calendar** view to see the week grid.

4. **Filters**: try searching by name ("yoga"), filtering by service or instructor. Clear filters with the X button.

5. **Click any session card** — a side sheet (right on desktop, bottom sheet on mobile) opens showing:
   - Date + time + duration
   - Service description
   - Price in MAD (formatted with `Intl.NumberFormat`)
   - "Pay at studio" subline (direct bookings don't run through Moovli)
   - Inline guest booking form

6. **Submit the booking** with a guest name + email + phone. Optional notes. Hit **Reserve · 200 MAD at studio**.

7. **Confirmation** state shows in the same sheet — "We've sent your reservation to the studio. They'll confirm by email."

### Part 2 — Studio inbox (operator perspective)

1. In a different browser / incognito, log in at `/login` as `studio@moovli.local`.

2. Land on `/studio/dashboard` — top banner shows **"1 pending booking needs your action"** (driven by the new dashboard metric).

3. Click the banner → goes to `/studio/bookings` filtered to **Pending**. The booking you just made shows up with the guest's name, the channel chip ("Direct"), and **Confirm / Decline** buttons.

4. Click **Confirm**. The status changes to `confirmed`. The guest will receive a confirmation email (in dev: check the API logs since SMTP is not wired locally).

5. Navigate to `/studio/customers` — the guest is now in the studio's CRM with:
   - Acquisition source: **Direct booking page**
   - First seen: just now
   - Total bookings: 1
   - Lifetime value: 200 MAD

### Part 3 — Studio dashboard insights

The dashboard now shows:
- **Marketplace revenue (7d)** — 0 MAD (this booking was direct, not marketplace)
- **Bookings this week** — 1
- **Channel mix (last 30 days)** — 100% direct, 0% marketplace
- **Next 24 hours** rail — shows the booked session with the booking count `1/12`

### Part 4 — Channels workspace

1. `/studio/channels` shows two cards: **Marketplace** and **Direct booking page**.

2. Click **Direct** → `/studio/channels/direct`. Shows:
   - Live URL: `http://localhost:3001/booking/the-pilates-studio-morocco`
   - Copy / Preview buttons
   - Brand color picker with live preview
   - On/off toggle (turning off hides the page everywhere without breaking existing bookings)

3. Click **Marketplace** → `/studio/channels/marketplace`. Shows the pricing breakdown — booker pays studio price + ~15% Moovli markup.

### What to highlight to the team

- **Channel attribution**: every booking knows its source. CRM "Acquisition source", dashboard channel mix, bookings inbox filter chips all derive from `bookings.channel_id`.
- **Guest bookings work without auth**: no signup friction. `bookings.user_id` is nullable; if the guest signs up later with the same email, a DB trigger back-fills `user_id` so their history merges.
- **Pricing snapshot**: `bookings.price_amount_at_booking` is frozen at create time. If the studio later changes the service price, this booking still says 200 MAD — safe refunds / audits.
- **Currency abstraction**: amounts go through `formatMoney(amount, entity.currency_code)`. Switch this studio's `entities.currency_code` to `EUR` and the entire UI re-renders in Euros — no code change.
- **Per-channel allocation**: in the studio session form, "Publish to Marketplace + Direct" can split capacity per channel with a time-based release back to the shared pool. Direct + marketplace can coexist on one session without overselling.

---

## Scenario C — Admin policies (bonus, for after the main demo)

**Login as admin** (any account with `is_admin = TRUE` — check the `users` table or use the admin setup script).

Visit `/admin/policies`. Shows DB-backed knobs grouped by category:

- **Credits**: `credit_value_amount` (1 credit = N MAD), `credit_expiry_days`
- **Pricing**: markup floor / ceiling for marketplace
- **Subscriptions**: trial duration
- **Bookings**: default cancellation window
- **General**: default currency

**Demo move:** click Edit on `credit_value_amount`, change from 10 to 12, save. Within 60s (the service cache TTL), new marketplace bookings derive credits at the new ratio with zero deploy. This is the foundation for the admin team's "tune the platform" workflow — markup adjustments per market, promo credit ratios, etc.

---

## Quick reset between demos

| To go from           | To this              | Run                                       |
| -------------------- | -------------------- | ----------------------------------------- |
| Ready studio (B)     | Onboarding demo (A)  | `seed-reset-onboarding.sql`               |
| Onboarding demo (A)  | Ready studio (B)     | `seed-demo.sql`                           |
| Mid-demo, clear bookings only | Re-test from clean slate | Re-run `seed-demo.sql` (idempotent — wipes bookings + reseeds sessions) |

---

## Open caveats to mention

- **Email confirmations** aren't wired locally — SMTP is configured but Brevo template IDs need real provisioning. Show the API logs at `tail -f /tmp/moovli-api.log` to demonstrate the send is attempted.
- **Stripe Products** are not created in any Stripe environment yet — `setup-stripe-entity-plans.ts` needs to be run before plan checkout actually works end-to-end. The wizard's Plan step opens Checkout regardless; the "no products" error surfaces inside Stripe.
- **Mobile app** is on hold per current priorities. The channel-aware booking + marketplace filter fixes shipped, but the rest of the v2 UX (richer dashboard, branding awareness, etc.) is web-only for now.
- **Cloud DB** is in sync with local for all migrations through 052. The demo can also be pointed at cloud by swapping `.env.local` for `.env`.
