# Teemer Moving & Storage Corp.

A full-featured web application for **Teemer Moving & Storage Corp.** (Long Beach, NY 11561) — combining a professional marketing website with a complete moving operations platform including customer booking, real-time tracking, digital contracts with e-signature, admin dashboard, and move captain mobile interface.

---

## Features

### Marketing Website
- **Landing Page** — Dual-entry splash with quick access to the information site and booking platform
- **Company Pages** — About, Services, Service Area, Photo Gallery, FAQ, Contact Form
- **Multi-Step Quote Form** — Room-by-room inventory selection, piano moving options, residential/commercial toggle, AI-powered box estimation, real-time pricing with crew/hour calculations
- **Deposit Payment** — Stripe Checkout integration for upfront deposits (under $1k = $50 flat; over $1k = 50%)

### Customer Experience
- **Customer Portal** — Request a move and track existing jobs
- **Real-Time Move Tracking** — Public tracking page via Job ID + email or direct email link with secure token
- **Digital Contracts** — E-signature page with full contract text, canvas signature pad (mouse + touch), agreement confirmation
- **Email Notifications** — Deposit confirmations, status updates, tracking links, invoices, contract signing requests

### Admin Operations Dashboard
- **Dashboard Overview** — Stat cards for total/pending/in-progress/completed jobs, quotes, deposits, revenue
- **Quotes Management** — Full quotes table with expand/collapse details, inline status changes, residential/commercial filtering
- **Jobs Management** — Filterable by 10 statuses, searchable by name/phone/email/job ID/invoice, slide-out detail panels
- **Job Detail Panel** — Complete job information, status timeline, email log, payment history, contract management
- **Contract Management** — Generate & send PDF contracts via email, view signing status, download PDFs, view customer signatures inline
- **Invoice Editor** — Editable line items (labor, travel, stair, storage, packing fees, extras, discounts), auto-calculated totals
- **Revenue Report** — Summary stats, monthly bar chart, filterable payment transactions, CSV export
- **Captain Assignment** — Assign move captains to jobs

### Move Captain Dashboard
- **Mobile-Optimized** — Large touch targets, expandable job cards
- **Status Workflow** — En Route → Arrived → Start Job → At Storage/Returning → Finish Job (+ Delayed)
- **Operational Notes** — Timestamped notes per job
- **Customer Notifications** — Key milestones (Arrived, In Progress, At Storage, Complete) automatically trigger customer emails

### Digital Contracts & E-Signature
- **PDF Generation** — Full multi-page contract with branding, legal sections (Damages, Terms, Confidentiality, Indemnification, Payment, Cancellations, Warranty), mover/client signature blocks, 5-employee acknowledgment table
- **Email Delivery** — PDF attachment sent to customer and admin with "Sign Your Contract" CTA button
- **Public Signing Page** — Full contract details, verbatim legal text, HTML5 canvas signature pad, agreement checkbox
- **Signature Storage** — Base64 PNG signature data, timestamp, IP address for audit trail
- **Admin Visibility** — Contract status badges, signed signature image preview, PDF download

### Pricing Engine
- **Residential** — Hourly rate × crew size × estimated hours, with stair/travel/packing surcharges
- **Commercial** — MAX(2× residential rate, tier minimum) where tiers are: small $1k, medium $3k, large $6k, enterprise $10k
- **Piano Surcharge** — Upright ground $350, upright stairs $500, grand $800
- **Weekend Surcharge** — 5% fee on weekend moves

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | pnpm workspaces |
| **Runtime** | Node.js 24 |
| **Language** | TypeScript 5.9 |
| **API Server** | Express 5 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Frontend** | React 19 + Vite + Tailwind CSS |
| **API Client** | OpenAPI spec → Orval codegen → React Query hooks |
| **Validation** | Zod (v4) + drizzle-zod |
| **Auth** | JWT (httpOnly cookies, 7-day expiry) |
| **Payments** | Stripe (deposits via Checkout Sessions) |
| **Email** | Resend (transactional emails with branded HTML templates) |
| **PDF** | PDFKit (contract generation) |
| **AI** | OpenAI (box estimation via Replit AI proxy) |
| **Build** | esbuild (ESM bundle with source maps) |
| **Charts** | Recharts (revenue dashboard) |
| **Animations** | Framer Motion |

---

## Project Structure

```
teemer-moving-storage/
├── artifacts/
│   ├── api-server/           # Express API server
│   │   ├── src/
│   │   │   ├── routes/       # API route handlers
│   │   │   │   ├── auth.ts         # Login, logout, user management
│   │   │   │   ├── quotes.ts       # Quote CRUD + Stripe checkout
│   │   │   │   ├── jobs.ts         # Job management + status updates
│   │   │   │   ├── contracts.ts    # Digital contract generation & signing
│   │   │   │   ├── tracking.ts     # Public move tracking
│   │   │   │   ├── contact.ts      # Contact form submissions
│   │   │   │   └── email-logs.ts   # Email history
│   │   │   └── lib/
│   │   │       ├── contract-pdf.ts   # PDFKit contract generator
│   │   │       ├── email-service.ts  # Resend email functions
│   │   │       ├── email-templates.ts# Branded HTML email templates
│   │   │       ├── pricing-engine.ts # Quote pricing calculations
│   │   │       ├── stripe-client.ts  # Stripe integration
│   │   │       └── auth.ts          # JWT middleware
│   │   └── build.mjs          # esbuild config
│   │
│   └── teemer-web/            # React frontend
│       └── src/
│           ├── pages/
│           │   ├── info/      # Marketing pages (home, about, services, etc.)
│           │   ├── admin/     # Admin dashboard + captain dashboard
│           │   ├── platform/  # Customer & provider portals
│           │   ├── track/     # Move tracking pages
│           │   └── sign/      # Contract e-signature page
│           ├── components/    # Shared UI components
│           └── App.tsx        # Router & layout
│
├── lib/
│   ├── api-spec/              # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/      # Generated React Query hooks & types
│   ├── api-zod/               # Generated Zod validation schemas
│   └── db/                    # Drizzle ORM schema & database connection
│       └── src/schema/
│           ├── jobs.ts
│           ├── quote-requests.ts
│           ├── contracts.ts
│           ├── invoices.ts
│           ├── payments.ts
│           ├── users.ts
│           └── ...
│
├── scripts/                   # Utility scripts (admin seeding, etc.)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Admin and move captain accounts (bcrypt-hashed passwords) |
| `customers` | Customer records |
| `quote_requests` | Move quote requests with inventory, pricing, and status |
| `jobs` | Moving jobs with full lifecycle tracking |
| `job_status_events` | Timeline of job status changes |
| `contracts` | Digital contracts (signing token, status, signature data, IP) |
| `invoices` | Editable invoices with line items |
| `payments` | Payment records (deposits, balance payments, cash) |
| `revenue_ledger` | Revenue tracking entries |
| `email_logs` | Email send history and delivery status |
| `contacts` | Contact form submissions |

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (email + password → JWT cookie) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/users` | Create user (admin) |
| GET | `/api/auth/users` | List users (admin) |

### Quotes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/quotes` | List quote requests |
| POST | `/api/quotes` | Submit a quote request |
| POST | `/api/quotes/estimate-boxes` | AI box estimation |
| POST | `/api/quotes/:id/checkout` | Create Stripe checkout session |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | List jobs (filterable, searchable) |
| POST | `/api/jobs` | Create a job |
| GET | `/api/jobs/:jobId` | Get job details |
| PATCH | `/api/jobs/:jobId` | Update job status/fields |
| POST | `/api/jobs/:jobId/send-invoice` | Send balance invoice email |
| POST | `/api/jobs/:jobId/email-customer` | Send custom email |

### Contracts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/:jobId/contracts` | Generate PDF + send to customer & admin |
| GET | `/api/jobs/:jobId/contract` | Get contract status |
| GET | `/api/contracts/sign/:token` | Get contract for signing (public) |
| POST | `/api/contracts/sign/:token` | Submit e-signature (public) |
| GET | `/api/jobs/:jobId/contracts/pdf` | Download contract PDF |

### Tracking
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/track/:id/:token` | Track by ID + token (public) |
| POST | `/api/track/lookup` | Look up by Job ID + email |

### Captain
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/captain/jobs` | List assigned jobs |
| PATCH | `/api/jobs/:jobId/captain-status` | Update operational status |
| POST | `/api/jobs/:jobId/captain-note` | Add operational note |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/revenue` | Revenue report |
| GET | `/api/admin/revenue/export` | CSV export |
| GET | `/api/invoices/:jobId` | Get invoice |
| PATCH | `/api/invoices/:jobId` | Save/update invoice |

---

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm 10+
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Seed admin user
pnpm --filter @workspace/scripts run seed-admin

# Generate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `ADMIN_PASSWORD` | Admin account password |
| `CAPTAIN_PASSWORD` | Move captain account password |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | Sender email address |
| `ADMIN_NOTIFICATION_EMAIL` | Admin notification recipient |
| `APP_BASE_URL` | Public app URL (for email links) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

### Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start web frontend
pnpm --filter @workspace/teemer-web run dev
```

---

## Business Rules

- **Deposits**: Under $1,000 total → $50 flat deposit; over $1,000 → 50% deposit
- **Mark Complete**: Blocked unless remaining balance is $0 or payment marked as paid/paid_cash
- **Piano Moving**: Surcharge auto-applied — Upright ground $350, Upright stairs $500, Grand $800
- **Commercial Pricing**: MAX(2× residential rate, tier minimum based on company size)
- **Weekend Moves**: 5% surcharge
- **Cancellation**: $75 late fee without proper notice (24hr for last-minute, 2 weeks for scheduled)

---

## Company Information

**Teemer Moving & Storage Corp.**
Long Beach, NY 11561
Phone: (516) 269-3724
Email: alan@teemermoving.com

Service Areas: Long Beach, Nassau County, Suffolk County, Manhattan, Queens, Brooklyn

---

## License

Private — All rights reserved.
