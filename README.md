# Teemer Moving & Storage Corp.

A full-featured web platform for **Teemer Moving & Storage Corp.** (Long Beach, NY 11561) — combining a marketing website with a complete moving operations platform: instant quoting, online booking, customer self-service accounts, real-time job tracking, digital contracts with e-signature, Stripe payments (deposits + balance + refunds), an admin operations dashboard, and a mobile-first move-captain app.

**Live:** [teemermoving.com](https://teemermoving.com)
**Phone:** (516) 269-3724
**US DOT #** 3716575 · **MC #** 1306475

---

## Table of Contents

- [Highlights](#highlights)
- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Monorepo Layout](#monorepo-layout)
- [Database Schema](#database-schema)
- [API Surface](#api-surface)
- [Pricing & Business Rules](#pricing--business-rules)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Company](#company)
- [License](#license)

---

## Highlights

- **End-to-end customer journey.** Quote → deposit → booking confirmation (`TM-XXXXXXXXXX`) → contract e-signature → live tracking → balance payment → completion, all without a phone call.
- **Customer accounts.** Self-serve signup with chosen username + password, email verification, password reset, dashboard with jobs / quotes / payment requests / invoices.
- **Admin operations center.** Quotes, jobs, invoices, payments, refunds, discount codes, captain assignments, revenue reports, settings — all in one panel.
- **Move-captain mobile app.** Field crew updates job status from their phone; status changes auto-email the customer.
- **Stripe-backed payments.** Deposits, balance pay, ad-hoc payment requests, and admin-initiated refunds with cancellation flow.
- **Server-driven pricing engine.** Residential, commercial, piano, junk, weekend, long-distance, packing, mounted-TV, and promo discounts — single source of truth, no client-side recalculation drift.
- **DB-backed discount codes.** Admins create / disable / expire / cap codes from the UI, no redeploy needed. `SANDV10` (Seniors & Veterans 10%) seeded.
- **Email throttling & anti-abuse.** Per-recipient + per-IP rate limiting on verification / password-reset endpoints; throttled UI states surface friendly copy instead of raw 429s.
- **Playwright e2e suite + CI gating.** Customer payment flow, balance payment, save-quote modal, and account flows are exercised against a real boot of the API + web servers before every deploy.

---

## Feature Overview

### Marketing Website

- Landing page with dual-entry splash (info site + booking platform)
- About, Services, Service Area, Photo Gallery (lightbox), FAQ, Contact
- Leadership profiles (CEO Alan Teemer, CTO Najee Jeremiah)
- Long Island Choice Awards 2025 auto-cycling slideshow
- Real crew & job photography across info pages
- Embedded video testimonials
- "Same Day Moves Available" hero badge
- Floating site-wide "Get an Instant Quote" CTA
- Contact page with full day-by-day hours
- Open Graph / Twitter cards, JSON-LD `LocalBusiness`, sitemap, robots.txt

### Quoting & Booking

- Multi-step quote form: residential / commercial toggle, room-by-room inventory, piano, junk, mounted TVs, packing add-on, packing arrival window
- AI-powered box estimation (OpenAI via Replit AI proxy with `OPENAI_API_KEY` fallback)
- Live, server-driven pricing preview (`POST /api/quotes/preview-hours`) with deterministic crew/hours math
- Pre-pack-day gating enforced server-side — packing date must precede move date
- Same-day move toggle disables date / arrival pickers
- Promo code entry with live validation against the discount-codes table
- Stripe Checkout deposit (under $1k → $50 flat, $1k+ → 50%)
- Booking confirmation card displays the deposit amount, paid-on date, and the `TM-XXXXXXXXXX` confirmation code
- "Save for later" modal lets visitors persist a quote into a new account mid-flow

### Customer Account & Dashboard

- Self-serve signup with user-chosen `username` (case-insensitive uniqueness, `[A-Za-z0-9_.]`, no trailing `.`) and password (≥8 chars, confirm-password match)
- Email verification (single-use JWT, purpose-tagged, expires)
- Password reset gated on email-verified accounts (otherwise a verification email is sent instead — anti-enumeration responses are identical for unknown addresses)
- Login / logout with JWT in httpOnly cookie
- Dashboard surfaces:
  - Active jobs and historical jobs
  - Saved quotes (with continue-checkout link)
  - Payment requests sent by the office
  - Past invoices and payment history
  - Email verification banner with friendly throttle states ("Try again later")
- Customer-initiated balance payments via Stripe
- Per-job tracking page accessible from the dashboard
- Auth email throttling: 3 / hour per recipient, 10 / hour per IP (configurable)

### Admin Operations Dashboard

- Stats: total / pending / in-progress / completed jobs, quotes, deposits, revenue
- Quotes table with expand-collapse details and inline status changes
- Jobs table filterable by 10 statuses + Same-Day "Today" pill, searchable by name / phone / email / Job ID / invoice; persistent filters across tab nav
- Slide-out job detail panel:
  - Status timeline + email log
  - Editable invoice (labor, travel, stair, storage, packing, mounted TV, extras, discounts) with auto-totals
  - Payment history with refund / cancellation actions (via `payment_refunds` table)
  - Contract management (generate PDF, send, view signed signature, download)
  - Send custom emails / send invoices
- Captain assignment per job
- **Discounts tab** — create / edit / disable / set expiration / set usage caps for promo codes; `SANDV10` is seeded. Usage cap is best-effort (counter increments on Stripe success); mid-checkout invalidation silently restores full price rather than blocking the customer.
- **Payments tab** — view all payments, send ad-hoc payment requests, issue refunds with optional job cancellation
- **Revenue report** — summary stats, monthly bar chart, filterable transactions, CSV export
- **Settings tab** — admin alert recipient, send-test-alert button

### Move-Captain Mobile App

- Mobile-first dashboard with large touch targets and expandable job cards
- Status workflow: En Route → Arrived → Start Job → At Storage / Returning → Finish Job (+ Delayed)
- Timestamped operational notes per job
- Key milestones (Arrived, In Progress, At Storage, Complete) auto-trigger customer email notifications
- Settings tab accessible on both mobile and desktop

### Same-Day Captain Alert System

- Jobs scheduled for today (or rescheduled to today) trigger an urgent admin alert email
- Alert contains move date, time window, addresses, customer info, and assigned captain
- Deduplicated via `email_logs` — only the first successful alert is sent; failed sends remain retryable
- Recipient configurable from the admin Settings tab

### Digital Contracts & E-Signature

- PDFKit-generated multi-page contract with DOT/MC numbers, full legal sections (Damages, Terms, Confidentiality, Indemnification, Payment, Cancellations, Warranty), mover/client signature blocks, employee acknowledgment table
- Contract overview with `CONTRACT DATE:` and `SCHEDULED DATE & TIME: from approximately …` rows
- Email delivery to customer + admin with "Sign Your Contract" CTA
- Public signing page (`/sign/:token`) with verbatim legal text, HTML5 canvas signature pad (mouse + touch), agreement checkbox
- Signature stored as base64 PNG with timestamp and IP for audit trail
- Admin sees status badges, signed signature image preview, and PDF download

### Pricing Engine

Centralized in `artifacts/api-server/src/lib/pricing-engine.ts`:

- **Residential** — hourly rate × crew × estimated hours, plus stair / travel / packing surcharges
- **Commercial** — `MAX(2× residential rate, tier minimum)` where tiers are small $1k, medium $3k, large $6k, enterprise $10k
- **Piano** — upright ground $350, upright stairs $500, grand $800
- **Junk Removal** — small $200, medium $375, large $575, full truck $750
- **Mounted TV** — $50 per TV (`MOUNTED_TV_FEE_PER_TV`, with `getEffectiveMountedTVFee` helper)
- **Weekend** — 5% surcharge
- **Long-distance** — $3 / mile beyond the configured threshold
- **Promo discounts** — applied at quote stage; preserved through invoice math after booking

---

## Tech Stack

| Layer            | Technology                                                                      |
| ---------------- | ------------------------------------------------------------------------------- |
| **Monorepo**     | pnpm workspaces                                                                 |
| **Runtime**      | Node.js 24                                                                      |
| **Language**     | TypeScript 5.9                                                                  |
| **API Server**   | Express 5                                                                       |
| **Database**     | PostgreSQL + Drizzle ORM                                                        |
| **Frontend**     | React 19 + Vite + Tailwind CSS                                                  |
| **API Contract** | OpenAPI 3.1 → Orval codegen → React Query hooks (`@workspace/api-client-react`) |
| **Validation**   | Zod (`zod/v4`) + drizzle-zod (`@workspace/api-zod`)                             |
| **Auth**         | JWT (purpose-tagged) in httpOnly cookies for both staff and customers           |
| **Payments**     | Stripe Checkout (deposits + balance) + webhooks + refunds                       |
| **Email**        | Resend with branded HTML templates and `email_logs` audit                       |
| **PDF**          | PDFKit (contracts)                                                              |
| **AI**           | OpenAI via Replit AI proxy (box estimation)                                     |
| **Build**        | esbuild (ESM bundle with source maps)                                           |
| **Charts**       | Recharts                                                                        |
| **Animations**   | Framer Motion                                                                   |
| **Testing**      | `node:test` (api-server) + Playwright (web e2e) + Replit CI workflow            |

---

## Monorepo Layout

```
teemer-moving-storage/
├── artifacts/                        # Deployable apps
│   ├── api-server/                   # Express API
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── auth.ts           # Staff login / users
│   │       │   ├── customer-auth.ts  # Signup, login, verify email, password reset, throttling
│   │       │   ├── customer.ts       # Customer dashboard data
│   │       │   ├── quotes.ts         # Quote CRUD, preview-hours, AI box estimation, Stripe checkout
│   │       │   ├── jobs.ts           # Jobs lifecycle + same-day alerts
│   │       │   ├── contracts.ts      # PDF generation + signing
│   │       │   ├── tracking.ts       # Public tracking
│   │       │   ├── stripe.ts         # Webhooks
│   │       │   ├── admin-payments.ts # Payments, requests, refunds
│   │       │   ├── discount-codes.ts # Admin CRUD for promo codes
│   │       │   ├── settings.ts       # Admin alert email config
│   │       │   ├── contact.ts        # Contact form
│   │       │   ├── email-logs.ts     # Email history
│   │       │   └── health.ts
│   │       └── lib/
│   │           ├── pricing-engine.ts
│   │           ├── auth.ts             # JWT issue/verify (purpose-tagged)
│   │           ├── auth-rate-limit.ts  # Per-recipient + per-IP throttle for auth emails
│   │           ├── email-service.ts    # Resend wrappers + same-day alert
│   │           ├── email-templates.ts  # Branded HTML templates
│   │           ├── contract-pdf.ts     # PDFKit contract generator
│   │           └── stripe-client.ts
│   │
│   ├── teemer-web/                   # React + Vite SPA
│   │   ├── public/                   # Photos, videos, OG image, sitemap, robots
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── info/             # Marketing pages + multi-step quote
│   │   │   │   ├── account/          # Customer signup/login/verify/reset/dashboard/job & quote detail/balance pay
│   │   │   │   ├── admin/            # Admin dashboard + revenue + payments tab + captain dashboard
│   │   │   │   ├── platform/         # Customer + provider portals
│   │   │   │   ├── track/            # Public tracking
│   │   │   │   ├── sign/             # Contract e-signature
│   │   │   │   └── splash.tsx
│   │   │   ├── components/
│   │   │   └── App.tsx
│   │   └── tests/e2e/                # Playwright specs
│   │
│   └── mockup-sandbox/               # Vite-based component preview server (design iteration)
│
├── lib/
│   ├── api-spec/                     # OpenAPI 3.1 + Orval codegen config
│   ├── api-client-react/             # Generated React Query hooks + types (do not edit)
│   ├── api-zod/                      # Generated Zod schemas (do not edit)
│   └── db/                           # Drizzle schema + migrations + connection
│       ├── src/schema/
│       └── migrations/               # 0000…0006 SQL migrations + meta/
│
├── scripts/
│   ├── post-merge.sh                 # Runs after task merges (pnpm install + db push)
│   └── run-e2e.sh                    # CI runner for Playwright suite (boots api+web on isolated ports)
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Database Schema

Managed by Drizzle. Source of truth: `lib/db/src/schema/`. Migrations in `lib/db/migrations/`.

| Table               | Purpose                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `users`             | Staff accounts (admin / move_captain), bcrypt-hashed passwords                                                     |
| `customers`         | Customer records — `username`, `password_hash`, `email_verified_at`, profile                                       |
| `quote_requests`    | Multi-step quote submissions with inventory, distance, surcharges, status                                          |
| `jobs`              | Move jobs — `trackingToken`, `assignedCaptainId`, `arrivalWindow`, `finalTotal`, `remainingBalance`, status fields |
| `job_status_events` | Lifecycle timeline                                                                                                 |
| `contracts`         | Digital contracts — signing token (UUID), status (sent / signed), customer signature (base64 PNG), IP, timestamp   |
| `invoices`          | Editable invoices with line items                                                                                  |
| `payments`          | Deposits, balance payments, payment-request payments, cash                                                         |
| `payment_refunds`   | Admin-issued refunds with optional cancellation linkage                                                            |
| `payment_requests`  | Ad-hoc payment requests sent to customers                                                                          |
| `discount_codes`    | DB-backed promo codes (admin CRUD); `SANDV10` seeded                                                               |
| `email_logs`        | All transactional sends — type, status, recipient (powers throttling + same-day-alert dedupe)                      |
| `revenue_ledger`    | Revenue tracking entries                                                                                           |
| `contacts`          | Contact form submissions                                                                                           |
| `settings`          | Admin-tunable config (e.g. alert recipient)                                                                        |

---

## API Surface

The full contract lives in `lib/api-spec/openapi.yaml`. Highlights:

### Staff Auth
| Method | Path                | Description                       |
| ------ | ------------------- | --------------------------------- |
| POST   | `/api/auth/login`   | Login (email + password → cookie) |
| POST   | `/api/auth/logout`  | Logout                            |
| GET    | `/api/auth/me`      | Current user                      |
| POST   | `/api/auth/users`   | Create user (admin)               |
| GET    | `/api/auth/users`   | List users (admin)                |

### Customer Auth
| Method | Path                                       | Description                                                                |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| POST   | `/api/customer-auth/signup`                | Self-serve signup (`fullName`, `email`, `username`, `password`, confirm)   |
| POST   | `/api/customer-auth/login`                 | Customer login                                                             |
| POST   | `/api/customer-auth/logout`                | Logout                                                                     |
| GET    | `/api/customer-auth/me`                    | Current customer                                                           |
| GET    | `/api/customer-auth/check-username`        | Case-insensitive availability check                                        |
| POST   | `/api/customer-auth/verify-email`          | Verify email (purpose-tagged JWT, single-use)                              |
| POST   | `/api/customer-auth/resend-verification`   | Resend verification (rate-limited, 429 with friendly UI copy)              |
| POST   | `/api/customer-auth/forgot-password`       | Request reset (anti-enumeration; verification email sent if not verified)  |
| POST   | `/api/customer-auth/reset-password`        | Reset password with token (single-use)                                     |
| GET    | `/api/customer-auth/reset-password/check`  | Pre-validate reset token                                                   |

### Quotes
| Method | Path                              | Description                                                |
| ------ | --------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/quotes`                     | List quote requests (admin)                                |
| POST   | `/api/quotes`                     | Submit a quote request                                     |
| POST   | `/api/quotes/preview-hours`       | Server-driven pricing preview (single source of truth)     |
| POST   | `/api/quotes/estimate-boxes`      | AI box estimation                                          |
| POST   | `/api/quotes/:id/checkout`        | Create Stripe Checkout session for the deposit             |

### Jobs
| Method | Path                                  | Description                                          |
| ------ | ------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/jobs`                           | List jobs (filter / search)                          |
| POST   | `/api/jobs`                           | Create a job                                         |
| GET    | `/api/jobs/:jobId`                    | Job details                                          |
| PATCH  | `/api/jobs/:jobId`                    | Update fields/status (fires same-day alert if today) |
| POST   | `/api/jobs/:jobId/send-invoice`       | Email balance invoice                                |
| POST   | `/api/jobs/:jobId/email-customer`     | Send custom email                                    |
| GET    | `/api/jobs/:jobId/contract`           | Contract status                                      |
| POST   | `/api/jobs/:jobId/contracts`          | Generate + send contract PDF                         |
| GET    | `/api/jobs/:jobId/contracts/pdf`      | Download contract PDF                                |

### Contracts (public)
| Method | Path                              | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/api/contracts/sign/:token`      | Get contract for signing             |
| POST   | `/api/contracts/sign/:token`      | Submit e-signature                   |

### Customer Self-Service
| Method | Path                                          | Description                              |
| ------ | --------------------------------------------- | ---------------------------------------- |
| GET    | `/api/customer/dashboard`                     | Jobs + quotes + payment requests + bills |
| POST   | `/api/customer/jobs/:jobId/balance-checkout`  | Stripe Checkout for remaining balance    |
| POST   | `/api/customer/payment-requests/:id/checkout` | Pay an ad-hoc payment request            |

### Tracking
| Method | Path                          | Description                |
| ------ | ----------------------------- | -------------------------- |
| GET    | `/api/track/:id/:token`       | Track by Job ID + token    |
| POST   | `/api/track/lookup`           | Look up by Job ID + email  |

### Captain
| Method | Path                                    | Description                  |
| ------ | --------------------------------------- | ---------------------------- |
| GET    | `/api/captain/jobs`                     | Assigned jobs                |
| PATCH  | `/api/jobs/:jobId/captain-status`       | Update operational status    |
| POST   | `/api/jobs/:jobId/captain-note`         | Add operational note         |

### Admin
| Method | Path                                       | Description                                 |
| ------ | ------------------------------------------ | ------------------------------------------- |
| GET    | `/api/admin/stats`                         | Dashboard stats                             |
| GET    | `/api/admin/revenue`                       | Revenue report                              |
| GET    | `/api/admin/revenue/export`                | CSV export                                  |
| GET    | `/api/invoices/:jobId`                     | Get invoice                                 |
| PATCH  | `/api/invoices/:jobId`                     | Save invoice                                |
| GET    | `/api/admin/payments`                      | List payments                               |
| POST   | `/api/admin/payments/:id/refund`           | Refund a payment (optional job cancel)      |
| GET    | `/api/admin/payment-requests`              | List payment requests                       |
| POST   | `/api/admin/payment-requests`              | Send a payment request                      |
| GET    | `/api/admin/discount-codes`                | List promo codes                            |
| POST   | `/api/admin/discount-codes`                | Create promo code                           |
| PATCH  | `/api/admin/discount-codes/:id`            | Edit / disable / cap                        |
| GET    | `/api/admin/settings`                      | Admin alert recipient                       |
| PUT    | `/api/admin/settings`                      | Update admin alert recipient                |
| POST   | `/api/admin/settings/test-alert`           | Send a test same-day alert                  |

### Stripe
| Method | Path                  | Description                      |
| ------ | --------------------- | -------------------------------- |
| POST   | `/api/stripe/webhook` | Stripe events (deposits, refunds)|

### Misc
| Method | Path             | Description                         |
| ------ | ---------------- | ----------------------------------- |
| POST   | `/api/contact`   | Contact form → DB + admin email     |
| GET    | `/api/healthz`   | Health probe (used by CI)           |

---

## Pricing & Business Rules

- **Deposits:** under $1,000 total → $50 flat; $1,000+ → 50%
- **Piano:** upright ground $350, upright stairs $500, grand $800 (auto-applied from inventory)
- **Junk Removal:** small $200, medium $375, large $575, full truck $750
- **Mounted TV:** $50 per TV
- **Commercial:** `MAX(2× residential rate, tier minimum)` (small $1k, med $3k, large $6k, enterprise $10k)
- **Weekend:** 5% surcharge
- **Long-distance:** $3 / mile beyond the configured threshold
- **Same-day:** date / arrival pickers disabled; triggers urgent admin alert (deduped via `email_logs`)
- **Cancellation:** $75 late fee without proper notice (24hr last-minute, 2 weeks scheduled)
- **Mark Complete:** server-blocks unless remaining balance is $0 or marked paid/paid_cash
- **Pre-pack-day gating:** packing date must be earlier than move date (enforced server-side via `preview-hours`)
- **`SANDV10`:** 10% discount for Seniors & Veterans, seeded in migration `0004`. Admin-managed in the **Discounts** tab. Usage caps are best-effort (counter increments after Stripe confirms deposit). If a code is disabled or expires mid-checkout, the deposit page silently restores the full price rather than blocking the customer.
- **Promo discount preservation:** promo discount is preserved through booking → invoice math, so balance invoices reflect the discounted amount.
- **Auth email throttling:** verification + reset emails — 3/hour per recipient, 10/hour per IP (configurable via `AUTH_EMAIL_RATE_PER_HOUR` and `AUTH_IP_RATE_PER_HOUR`).
- **Password reset is verified-only:** unverified accounts get a verification email instead; identical 200 responses prevent enumeration.

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL database

### Install & Bootstrap

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Generate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

### Run Locally

```bash
# API server (Express)
pnpm --filter @workspace/api-server run dev

# Web app (Vite)
pnpm --filter @workspace/teemer-web run dev

# Component preview sandbox (optional, for design iteration)
pnpm --filter @workspace/mockup-sandbox run dev
```

In Replit each artifact has its own workflow (`artifacts/api-server: API Server`, `artifacts/teemer-web: web`, `artifacts/mockup-sandbox: Component Preview Server`) and is reachable through the path-based preview proxy.

---

## Environment Variables

| Variable                    | Required | Description                                                     |
| --------------------------- | -------- | --------------------------------------------------------------- |
| `DATABASE_URL`              | yes      | PostgreSQL connection string                                    |
| `JWT_SECRET`                | yes      | Secret for staff & customer JWT signing (purpose-tagged tokens) |
| `RESEND_API_KEY`            | yes      | Resend transactional email API key                              |
| `RESEND_FROM_EMAIL`         | yes      | Sender email                                                    |
| `STRIPE_SECRET_KEY`         | yes      | Stripe secret key                                               |
| `STRIPE_WEBHOOK_SECRET`     | yes      | Stripe webhook signing secret                                   |
| `APP_BASE_URL`              | yes      | Public app URL (used in email links, signing URLs, etc.)        |
| `ADMIN_NOTIFICATION_EMAIL`  | no       | Default admin alert recipient (overridable via Settings tab)    |
| `OPENAI_API_KEY`            | no       | Fallback for AI box estimation if Replit AI proxy unavailable   |
| `AUTH_EMAIL_RATE_PER_HOUR`  | no       | Per-recipient cap on auth emails (default 3)                    |
| `AUTH_IP_RATE_PER_HOUR`     | no       | Per-IP cap on auth emails (default 10)                          |
| `ADMIN_PASSWORD`            | no       | Initial admin seed                                              |
| `CAPTAIN_PASSWORD`          | no       | Initial captain seed                                            |

---

## Testing

### API server (`node:test`)

```bash
pnpm --filter @workspace/api-server test
```

Covers customer-auth (signup / login / verify / forgot / reset / throttling), admin-payments, pricing-engine, and more. The customer-auth suite alone exercises every branch of token validation, single-use enforcement, and anti-enumeration behavior.

### End-to-end (Playwright)

```bash
# Boots api-server (port 23080) + teemer-web (port 23308) on isolated ports,
# installs Chromium one-time, runs all specs, tears down on exit.
bash scripts/run-e2e.sh
```

Specs in `artifacts/teemer-web/tests/e2e/`:

- `customer-payment-flow.spec.ts` — quote → deposit → confirmation → tracking
- `customer-balance-payment.spec.ts` — customer paying remaining balance
- `save-quote-modal.spec.ts` — save-for-later signup mid-quote
- (additional specs as the suite grows)

The **`E2E Payment Flow`** workflow runs the same script in CI and gates deploys.

---

## Deployment

The app is deployed on Replit:

- API server, web app, and mockup-sandbox are independent artifacts with their own workflows.
- Each artifact binds to the `PORT` env var assigned at runtime.
- Database migrations are applied automatically after every task merge via `scripts/post-merge.sh` (`pnpm install --frozen-lockfile && pnpm --filter db push`).
- Deploys are gated on the `E2E Payment Flow` Playwright suite passing.

---

## Company

**Teemer Moving & Storage Corp.**
Long Beach, NY 11561
Phone: (516) 269-3724
Public Email: info@teemermoving.com
Admin Email: alan@teemermoving.com
US DOT # 3716575 · MC # 1306475

**Service Areas:** Long Beach, Nassau County, Suffolk County, Manhattan, Queens, Brooklyn

**Leadership**

| Name                    | Title                    |
| ----------------------- | ------------------------ |
| Alan Teemer             | Chief Executive Officer  |
| Najee Khaleel Jeremiah  | Chief Technology Officer |

---

## License

Private — all rights reserved.
