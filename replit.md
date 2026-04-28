# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── teemer-web/         # Teemer Moving & Storage React web app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Teemer Moving & Storage Application

### What it is
A full-featured moving company web app with two distinct experiences:
1. **Information Website** — marketing site for Teemer Moving & Storage
2. **Moving Platform** — Uber-like marketplace for booking/finding/tracking moves

### Routes

**Splash / Landing:**
- `/` — Dual-entry splash page

**Information Website:**
- `/info` — Home page (marketing)
- `/info/about` — About Teemer
- `/info/services` — Services grid
- `/info/service-area` — Service area coverage
- `/info/gallery` — Photo gallery
- `/info/faq` — FAQ accordion
- `/info/contact` — Contact form
- `/info/quote` — Multi-step quote request form
- `/info/quote/deposit/:quoteId` — Deposit payment page (Stripe checkout redirect)
- `/info/quote/confirmation` — Payment confirmation page

**Tracking:**
- `/track` — Track your move lookup page (Job ID + email form)
- `/track/:id/:token` — Track by direct tracking token link (from email)

**Contract Signing (public):**
- `/sign/:token` — Customer e-signature page (contract details, legal terms, canvas signature pad, agreement checkbox)

**Platform:**
- `/platform` — Platform entry
- `/platform/customer` — Customer portal (Request Move + Track Job tabs)
- `/platform/provider` — Provider portal (Job Marketplace, Earnings)

**Admin:**
- `/admin/login` — Admin/Captain login page (email + password). Redirects admin to `/admin`, captain to `/admin/captain`.
- `/admin` — Admin Operations Control Center (protected, admin role only)
  - **Dashboard tab**: Overview stat cards (Total Jobs, Pending Jobs, In Progress, Completed, Total Quotes, Deposits Collected, Remaining Balances, Cash Payments, Total Revenue), Quick Actions, Revenue Pipeline
  - **Quotes tab**: Full quotes table with expand/collapse details, inline status change
  - **All Jobs tab**: Filterable (all 10 statuses), searchable (name/jobId/phone/email/invoice), full jobs table with Invoice column, slide-out detail panel
  - **Job Detail Panel**: Full job info, StatusTimeline, email log, payment history, admin actions (Assign Captain, status dropdown, Mark Paid Cash, Mark Complete, Send Invoice, Email Customer, Edit Invoice)
  - **Invoice Editor Modal**: Editable line items (labor hours, hourly rate, travel/stair/storage/packing fees, extra charges, discounts), auto-calculates subtotal/final/remaining balance, saves to invoices table
- `/admin/revenue` — Revenue & Payments Report (protected, admin role only)
  - Summary stat cards (Total Revenue, Cash, Card/Stripe, Deposits, Balance Payments, Transactions)
  - Monthly revenue bar chart
  - Filterable payment transactions table (date range, payment method)
  - CSV export with formula injection protection
- `/admin/captain` — Captain Dashboard (protected, captain or admin role)
  - **Mobile-optimized** layout (max-w-lg, large touch targets)
  - **Stat cards**: Active, Upcoming, Completed job counts
  - **Tabs**: Today (active jobs), Upcoming, Completed
  - **Job cards**: Expandable with pickup/dropoff, date/time, crew, job details
  - **Status buttons**: En Route → Arrived → Start Job → At Storage/Returning → Finish Job (+ Delayed)
  - **Notes**: Add timestamped operational notes
  - Key milestone status changes (Arrived, In Progress, At Storage, Complete) trigger customer email notifications
  - Captains can only see/update their own assigned jobs

### Company Details
- **Name**: Teemer Moving & Storage Co.
- **Phone**: (516) 269-3724
- **Location**: Long Beach, NY 11561
- **Service Areas**: Long Beach, Nassau County, Suffolk County, Manhattan, Queens, Brooklyn

### Database Schema
- `users` — Admin/Captain user accounts (bcrypt-hashed passwords, roles: admin/move_captain)
- `customers` — Customer records (includes `password_hash`, `email_verified_at` for self-service accounts)
- `quote_requests` — Customer move quote requests
- `jobs` — Moving jobs (extended with trackingToken, assignedCaptainId, arrivalWindow, finalTotal, remainingBalance, paymentStatus, invoiceStatus)
- `job_status_events` — Job lifecycle timeline events
- `invoices` — Invoices for jobs
- `payments` — Payment records
- `revenue_ledger` — Revenue tracking entries
- `email_logs` — Email notification logs
- `contacts` — Contact form submissions
- `contracts` — Digital moving contracts (signingToken UUID, status: sent/signed, customerSignatureData base64 PNG, customerSignedAt, customerIpAddress)

### Authentication
- **Method**: JWT tokens via httpOnly cookies (cookie name: `teemer_auth`, 7-day expiry)
- **Secret**: JWT_SECRET env var (defaults to dev secret)
- **Roles**: `admin`, `move_captain`
- **Default admin**: admin@teemer.com / TeemerAdmin2024! (or ADMIN_PASSWORD env var)
- **Seed script**: `pnpm --filter @workspace/scripts run seed-admin`
- **Middleware**: `requireAuth`, `requireAdmin`, `requireCaptainOrAdmin`
- **Frontend**: AuthProvider context wraps app, AdminAuthGuard protects /admin (admin only), CaptainAuthGuard protects /admin/captain (captain or admin)

### API Endpoints
- `POST /api/auth/login` — Login (email + password → JWT cookie)
- `POST /api/auth/logout` — Logout (clears cookie)
- `GET /api/auth/me` — Get current authenticated user
- `POST /api/auth/users` — Create user (admin only)
- `GET /api/auth/users` — List users (admin only)
- `POST /api/customer-auth/signup|login|logout` — Customer self-service account auth (cookie `teemer_customer_auth`)
- `GET /api/customer-auth/me` — Current customer (includes `emailVerified`)
- `POST /api/customer-auth/verify-email` — Confirm email via signed token (24h, sets `email_verified_at`)
- `POST /api/customer-auth/resend-verification` — Re-send verification email (auth required)
- `POST /api/customer-auth/forgot-password` — Always returns 200 (no enumeration); emails reset link if account exists
- `GET /api/customer-auth/reset-password/check` / `POST /api/customer-auth/reset-password` — JWT reset token (1h, single-use via bcrypt-hash binding); successful reset logs the customer in
- `GET/POST /api/quotes` — Quote requests
- `POST /api/quotes/estimate-boxes` — AI box estimation (OpenAI via Replit AI proxy)
- `POST /api/quotes/:id/checkout` — Stripe Checkout Session for deposit
- `POST /api/stripe/webhook` — Stripe webhook (marks quote deposit_paid, sends deposit confirmation + admin notification emails)
- `GET/POST /api/jobs` — Jobs
- `GET/PATCH /api/jobs/:jobId` — Individual job + status updates (PATCH auto-records timeline events for status changes and captain assignments)
- `GET /api/jobs/:jobId/events` — Job timeline events (admin only)
- `POST /api/jobs/:jobId/events` — Create timeline event (admin only)
- `GET /api/track/:id/:trackingToken` — Public tracking by ID + token (no auth, customer-visible events only)
- `POST /api/track/lookup` — Public tracking lookup by Job ID + email (no auth)
- `POST /api/contact` — Contact form
- `POST /api/jobs/:jobId/send-invoice` — Send remaining balance invoice email (admin only)
- `POST /api/jobs/:jobId/email-customer` — Send custom email to customer (admin only)
- `GET /api/captain/jobs` — List jobs assigned to current captain (captain or admin)
- `PATCH /api/jobs/:jobId/captain-status` — Captain updates operational status (captain or admin, validates allowed statuses, triggers customer emails on key milestones)
- `POST /api/jobs/:jobId/captain-note` — Captain adds timestamped operational note (captain or admin)
- `GET /api/admin/stats` — Admin dashboard stats
- `GET /api/admin/email-logs/:jobId` — Email send history per job (admin only)
- `GET /api/invoices/:jobId` — Get invoice for a job (admin only)
- `PATCH /api/invoices/:jobId` — Save/update invoice for a job (admin only, auto-calculates totals, saves to invoices table + updates job)
- `GET /api/admin/revenue` — Revenue report with filters (from/to dates, method, status) + summary + monthly chart data
- `GET /api/admin/revenue/export` — CSV export of payment transactions with filters
- `POST /api/jobs/:jobId/contracts` — Generate PDF contract + send to customer and admin via email (admin only)
- `GET /api/jobs/:jobId/contract` — Get contract record for a job (admin only)
- `GET /api/contracts/sign/:token` — Get contract data by signing token (public, for customer signing page)
- `POST /api/contracts/sign/:token` — Submit customer e-signature (public)
- `GET /api/jobs/:jobId/contracts/pdf` — Download contract as PDF (admin only)

### Business Rules
- **Booking Workflow**: When admin sets quote status to "booked", a Job record is auto-created in a single transaction (quote update + job insert). Booking confirmation email is sent to the customer. If a job already exists for the quote, no duplicate is created.
- **Mark Complete**: Job cannot be marked complete unless remaining balance is $0 or payment status is paid/paid_cash (enforced server-side)
- **Mark Paid (Cash)**: Creates payment record + revenue_ledger entry atomically
- **Invoice Save**: Auto-calculates subtotal from line items, computes remaining balance accounting for all prior payments
- **Piano Surcharge**: Flat fee added to quote total — Upright ground $350, Upright stairs $500, Grand $800. Auto-detected from inventory or explicit pianoType/pianoFloor fields. Shown as "Piano Moving Fee" line item in quote results.

### Email System (Resend)
- **Service**: `artifacts/api-server/src/lib/email-service.ts` — centralized send functions
- **Templates**: `artifacts/api-server/src/lib/email-templates.ts` — branded HTML templates
- **Functions**: sendDepositConfirmationEmail, sendAdminNewJobNotification, sendStatusUpdateEmail, sendTrackingLinkEmail, sendRemainingBalanceInvoiceEmail, sendPaymentReceivedEmail, sendJobCompletedEmail, sendContractEmail, sendBookingConfirmationEmail, sendDayBeforeReminderEmail
- **Automatic triggers**: Deposit confirmation + admin notification fire on Stripe webhook deposit_paid; Booking confirmation fires when quote status set to "booked" (auto-creates job); Day-before reminder cron runs daily at 9 AM
- **Cron**: `artifacts/api-server/src/lib/reminder-cron.ts` — daily cron job (9:00 AM) sends day-before reminder emails for jobs scheduled the next day, with deduplication via email_logs
- **Logging**: All sends logged to email_logs table (sent/failed/skipped)
- **Graceful fallback**: If RESEND_API_KEY is not set, emails are skipped with warning log
- **Env vars**: RESEND_API_KEY, RESEND_FROM_EMAIL (default: noreply@teemer.com), ADMIN_NOTIFICATION_EMAIL (default: admin@teemer.com), APP_BASE_URL

### Integrations
- **OpenAI**: Uses Replit AI Integrations proxy (`AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`), falls back to `OPENAI_API_KEY`
- **Stripe**: Uses Replit Stripe connector (`getUncachableStripeClient()` in `src/lib/stripe-client.ts`), fetches credentials from Replit connection API. Webhook secret via `STRIPE_WEBHOOK_SECRET` env var.
- **Resend**: Email delivery via RESEND_API_KEY

### Frontend Packages
- `react-hook-form` + `@hookform/resolvers` + `zod` — Form management
- `recharts` — Revenue charts in admin dashboard
- `framer-motion` — Animations
- `date-fns` — Date formatting
- `clsx` + `tailwind-merge` — Class utilities

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema to PostgreSQL

## Automated Tests

### API tests (node:test, real Postgres)
- `pnpm --filter @workspace/api-server test` — runs every `src/**/*.test.ts` file with `node --import tsx --test`. Quietly forces `LOG_LEVEL=silent` and `RESEND_API_KEY=` so test runs don't spam logs or send real emails.
- Shared helpers: `artifacts/api-server/src/routes/test-helpers.ts` boots an in-memory express server (no port collision with the dev workflow), provides a CookieJar-aware `api()` fetch wrapper, mints unique tags / emails / usernames, signs admin JWTs, seeds quotes/jobs, and tracks every row created so the trash-bin cleanup runs after each suite.
- Coverage today: `customer-auth.test.ts` (signup/login/logout/me + +username uniqueness + attachQuoteId match-vs-mismatch + check-username) and `admin-payments.test.ts` (POST/GET payment-requests, GET payments with method/search/all filters, customer lookup) plus the existing `pricing-engine.test.ts`. **69 tests / 16 suites all green.**

### End-to-end tests (Playwright)
- Spec: `artifacts/teemer-web/tests/e2e/customer-payment-flow.spec.ts` exercises Save-for-later → customer dashboard → admin **Send Payment Request** modal → customer self-serve pay → `TM-XXXXXXXXXX` confirmation, with the Stripe step performed by signing a synthetic `checkout.session.completed` event and POST-ing it to `/api/stripe/webhook` (so the test is hermetic — no live Stripe checkout).
- Setup notes live in `artifacts/teemer-web/tests/e2e/README.md`. Requires `STRIPE_WEBHOOK_SECRET` to be set on the API server *and* exported to the test runner (the test signs with that exact value), and a one-time `pnpm --filter @workspace/teemer-web test:e2e:install` to download the Chromium browser.
- Run with `pnpm --filter @workspace/teemer-web test:e2e`.
