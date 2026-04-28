# Overview

This project is a pnpm workspace monorepo using TypeScript, designed for Teemer Moving & Storage Co. It comprises a full-featured web application offering a marketing site and an "Uber-like" moving platform. The platform handles booking, tracking, and management of moving jobs for both customers and service providers. The project aims to streamline operations, enhance customer experience, and provide robust administrative tools for managing quotes, jobs, payments, and revenue.

The business vision is to modernize the moving industry by providing an intuitive digital platform for both customers and service providers. It seeks to capture market share by offering a superior user experience for booking, tracking, and managing moves, alongside efficient administrative tools.

## User Preferences

I prefer concise and clear communication.
I value iterative development and expect to be consulted before major architectural changes or feature implementations.
Please ensure all solutions are scalable and maintainable.
I prefer detailed explanations for complex solutions.
I want to prioritize user experience and intuitive design.
I prefer that you do not make changes to the `lib/api-spec/` folder.
I prefer that you do not make changes to the `lib/api-client-react/` folder.
I prefer that you do not make changes to the `lib/api-zod/` folder.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)

**Monorepo Structure:**
- `artifacts/`: Contains deployable applications (`api-server`, `teemer-web`).
- `lib/`: Houses shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

**Teemer Moving & Storage Application Features:**

**User Interfaces:**
- **Information Website**: Marketing pages (`/info`, `/info/about`, `/info/services`, etc.), quote request forms, deposit payment, and confirmation pages.
- **Moving Platform**: Dual entry splash page (`/`), customer portal (`/platform/customer`), and provider portal (`/platform/provider`).
- **Tracking**: Public job tracking (`/track`).
- **Contract Signing**: Public e-signature page (`/sign/:token`).
- **Admin Panel**: Secure `admin` section with login, dashboard, quote management, job management (with detailed panel and invoice editor), revenue reports, and captain dashboards.

**UI/UX Decisions:**
- **Mobile Optimization**: Captain Dashboard is mobile-optimized with large touch targets for on-the-go use.
- **Design Approach**: Standard web application patterns with distinct user flows for customers, providers, and administrators.

**Key Technical Implementations:**
- **Authentication**: JWT tokens stored in httpOnly cookies for both admin/captain and customer accounts. Role-based access control (`admin`, `move_captain`) is enforced via middleware.
- **Email System**: Centralized email service using Resend, with branded HTML templates and logging to `email_logs` table. Includes automatic triggers for various events (e.g., booking confirmation, status updates). A daily cron job sends day-before reminder emails.
- **Contract Management**: Digital contract signing with customer e-signature capture (canvas signature pad) and PDF generation.
- **Booking Workflow**: Automated job creation and confirmation emails upon quote booking.
- **Payment Processing**: Server-side enforcement for job completion based on payment status ($0 remaining balance required).
- **Invoice Management**: Dynamic invoice editor with auto-calculation and payment tracking.
- **Business Logic**: Includes specific rules like piano surcharges, atomic transactions for financial and job state changes, and automated piano surcharge calculation based on inventory.

**Key Features:**
- **Quote Management**: Multi-step quote request form, AI box estimation, and deposit payment via Stripe.
- **Job Tracking**: Public-facing job tracking by ID and token, and a lookup page by Job ID and email.
- **Customer Portal**: Self-service account creation, move requests, and job tracking.
- **Provider Portal**: Job marketplace and earnings overview for moving captains.
- **Admin Operations Control Center**: Comprehensive dashboard for managing quotes, jobs, invoices, payments, and user accounts. Includes detailed job views, status timelines, email logs, and an invoice editor.
- **Revenue & Payments Report**: Admin section for detailed revenue tracking, including summary stats, monthly charts, and CSV export.
- **Captain Dashboard**: Mobile-optimized interface for captains to manage assigned jobs, update operational statuses, and add notes. Status changes trigger customer email notifications.

**Frontend Technologies:**
- `react-hook-form` + `@hookform/resolvers` + `zod` for form management.
- `recharts` for admin dashboard visualizations.
- `framer-motion` for animations.
- `date-fns` for date handling.
- `clsx` + `tailwind-merge` for CSS class utilities.

## External Dependencies

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email Service**: Resend (via RESEND_API_KEY)
- **Payment Gateway**: Stripe (Stripe Checkout Sessions, Stripe webhooks)
- **AI Services**: OpenAI (via Replit AI Integrations proxy, falls back to OPENAI_API_KEY)

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
- **CI orchestration:** the **`E2E Payment Flow`** workflow (manual / autoStart=false) runs `bash scripts/run-e2e.sh`, which boots a hermetic API + web pair on dedicated ports (`23080` / `23308` — kept off the always-on dev workflow ports `8080` / `25308` and clear of Replit-reserved ports like `18080`), waits on `/api/healthz` + the web base URL, runs a `STRIPE_WEBHOOK_SECRET` preflight, runs the Playwright spec under `CI=1`, and tears the servers back down (artifacts land under `artifacts/teemer-web/{test-results,playwright-report}/`). The script defaults to a hermetic `STRIPE_WEBHOOK_SECRET=whsec_e2e_local_test_only` so the run never touches a real secret, and prefers the system Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (set in the script and respected by `playwright.config.ts`) so Playwright doesn't have to download its own browser. Two routing tweaks made this work end-to-end: (1) outside production the Vite dev server has no `/api` proxy, so the script sets `VITE_DEV_API_PROXY_TARGET=http://localhost:23080` and `vite.config.ts` forwards `/api/*` to the harness API server when that env is set; (2) the script ships a portable `kill_port` helper (the container has neither `fuser` nor a `ss -p` capable of showing PIDs) that walks `/proc/net/tcp{,6}` → socket inode → `/proc/*/fd/*` to release any orphaned grandchild before each run.
