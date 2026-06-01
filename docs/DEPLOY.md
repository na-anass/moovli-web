# Moovli v2 — Production Deploy (Digital Ocean + nginx + PM2)

End-to-end deployment of the studio dashboard (`app.moovli.app`) and the
public booking pages (`booking.moovli.app`) to the existing DO droplet that
already hosts `api.moovli.app`. Both web surfaces are served by a **single**
Next.js process — middleware routes the booking subdomain to `/booking/<path>`
internally.

---

## Topology

```
                                    ┌──────────────────────────────────────┐
                                    │  Digital Ocean droplet               │
                                    │  moovli-prod-fra1-01                 │
                                    │                                      │
   api.moovli.app ────── nginx ─────┼──► 127.0.0.1:3000 (moovli-api · PM2) │
   app.moovli.app ────── nginx ─────┼──► 127.0.0.1:3001 (moovli-web · PM2) │
   booking.moovli.app ── nginx ─────┼──►        ▲                          │
                                    │           │ same process; middleware │
                                    │           │ rewrites booking.* host  │
                                    │           │ to /booking/<path>       │
                                    └──────────────────────────────────────┘
```

---

## 1 · DNS (Dynadot)

Add **two** A records pointing at the droplet's public IP (same as the one
api.moovli.app already resolves to — confirm with `dig api.moovli.app`).

| Type | Host | Value |
|---|---|---|
| A | `app` | *(droplet IP)* |
| A | `booking` | *(droplet IP)* |

TTL 600s is fine for initial setup; bump to 3600s after smoke tests pass.
Propagation usually takes <5 min on Dynadot.

Verify before moving on:

```bash
dig +short app.moovli.app
dig +short booking.moovli.app
# both should return the droplet IP
```

---

## 2 · Get the web repo on the droplet

```bash
# As root (or a sudoer)
cd /opt/apps
git clone https://github.com/na-anass/moovli-web.git
cd moovli-web
git checkout dev-v2.0          # or main, once dev-v2.0 lands there
```

Layout after this step:

```
/opt/apps/
├── moovli-api/        (already there)
└── moovli-web/        (new)
```

---

## 3 · Environment file

`NEXT_PUBLIC_*` values are baked into the JS bundle at `npm run build` time.
You must drop the env file in place **before** building.

```bash
cd /opt/apps/moovli-web
cp deploy/.env.production.template .env.production
nano .env.production    # fill in the Supabase anon key + verify URLs
```

Required values at minimum (the template documents each):

- `NEXT_PUBLIC_API_URL=https://api.moovli.app`
- `NEXT_PUBLIC_SUPABASE_URL=https://xaujutbtmpdnuqxgpokf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=` *(from Supabase dashboard → Settings → API)*
- `NEXT_PUBLIC_BOOKING_BASE_URL=https://booking.moovli.app`

---

## 4 · Build

```bash
cd /opt/apps/moovli-web

# Use the same Node version as the API. If you don't have nvm:
#   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm use 20    # or whichever Node the droplet has — Next 14+ needs ≥18.17

npm ci                 # ~1–2 min
npm run build          # ~2–3 min; emits .next/

# Sanity test before handing to PM2:
NODE_ENV=production PORT=3001 node node_modules/next/dist/bin/next start -p 3001 &
sleep 3
curl -sI http://127.0.0.1:3001/ | head -1   # expect HTTP/1.1 200 OK
kill %1
```

---

## 5 · PM2

If PM2 isn't already on the droplet:

```bash
npm install -g pm2
pm2 startup systemd    # generates a systemctl unit; copy/paste the command it prints
```

The ecosystem file in **moovli-api/deploy/ecosystem.config.js** defines both
the API and the web process — apply it once and both restart together going
forward.

```bash
cd /opt/apps/moovli-api
git pull                                     # if you haven't already
pm2 startOrReload deploy/ecosystem.config.js --env production
pm2 save                                     # persist across reboot
pm2 status                                   # both should be "online"
```

Useful tail commands:

```bash
pm2 logs moovli-web --lines 100
pm2 logs moovli-api --lines 100
pm2 monit                                    # live dashboard, ctrl-c to exit
```

---

## 6 · nginx

Copy the two new site configs into place, link them, reload nginx, then run
Certbot for TLS — same flow as `api.moovli.app`.

```bash
cd /opt/apps/moovli-api
sudo cp deploy/nginx/app.moovli.app.conf      /etc/nginx/sites-available/app.moovli.app
sudo cp deploy/nginx/booking.moovli.app.conf  /etc/nginx/sites-available/booking.moovli.app

sudo ln -s /etc/nginx/sites-available/app.moovli.app     /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/booking.moovli.app /etc/nginx/sites-enabled/

sudo nginx -t           # syntax check
sudo systemctl reload nginx

# TLS — one cert each. Certbot rewrites the configs to add the SSL bits.
sudo certbot --nginx -d app.moovli.app
sudo certbot --nginx -d booking.moovli.app
```

Verify auto-renewal is wired (Certbot installs the timer for you):

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

---

## 7 · Smoke tests

```bash
# Public surfaces respond
curl -sI https://app.moovli.app/             | head -1   # HTTP/2 200 (or 307 if signed-out → /login)
curl -sI https://booking.moovli.app/         | head -1   # HTTP/2 200 (or 404 if no slug)
curl -sI https://api.moovli.app/health       | head -1   # HTTP/2 200

# Studio login flow
open https://app.moovli.app/login            # use studio@moovli.local creds OR cloud user
# After login → /studio/dashboard            # dashboard data should populate

# Public direct page
open https://booking.moovli.app/the-pilates-studio-morocco
#       └── middleware rewrites to /booking/the-pilates-studio-morocco internally
```

If `booking.moovli.app/<slug>` 404s but `app.moovli.app/booking/<slug>` works,
the host-based rewrite is broken — check that nginx is forwarding the
original `Host` header (it is in the supplied config) and that
`NEXT_PUBLIC_BOOKING_BASE_URL` points at the booking subdomain.

---

## 8 · Update flow (going forward)

```bash
# On the droplet
cd /opt/apps/moovli-web
git pull
npm ci                        # only if package.json / lockfile changed
npm run build
pm2 reload moovli-web         # zero-downtime restart

cd /opt/apps/moovli-api
git pull
npm ci
npm run build
pm2 reload moovli-api
```

Migrations are still manual via `docker run postgres:17 psql "$DATABASE_URL"
-f database/migrations/migration_NNN.sql` (see existing `seed-demo.sql` flow
in `DEMO.md`).

---

## Caveats specific to first-test environment

- **Stripe is in test mode** unless `STRIPE_SECRET_KEY` was bumped to live.
  Plan checkout will work end-to-end but no real money moves until that
  swap.
- **No Stripe Products created yet** on the cloud Stripe account — run
  `npx ts-node moovli-api/database/setup-stripe-entity-plans.ts` against
  production before any studio hits Billing.
- **SMTP / Brevo** — credentials are in `moovli-api/.env` already; emails
  will actually send from the droplet. Heads-up before the first guest
  booking.
- **Cloud DB has migrations through 052** — match local. Apply any new
  migration to the cloud Postgres before deploying API code that depends on
  it.

---

## File index

| File | Where it goes |
|---|---|
| `moovli-api/deploy/ecosystem.config.js` | Stays in repo. Applied via `pm2 startOrReload`. |
| `moovli-api/deploy/nginx/app.moovli.app.conf` | Copied to `/etc/nginx/sites-available/app.moovli.app`. |
| `moovli-api/deploy/nginx/booking.moovli.app.conf` | Copied to `/etc/nginx/sites-available/booking.moovli.app`. |
| `moovli-web/deploy/.env.production.template` | Copied to `/opt/apps/moovli-web/.env.production`. Edit secrets before build. |
| `moovli-web/docs/DEPLOY.md` | This document — the operational source of truth. |

Reach out via the team chat with the droplet IP / PM2 logs if anything in
the chain misbehaves.
