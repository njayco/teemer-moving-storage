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
