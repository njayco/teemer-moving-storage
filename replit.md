# Workspace

## Overview

This project is a pnpm workspace monorepo using TypeScript, designed for Teemer Moving & Storage Co. It comprises a full-featured web application offering a marketing site and an "Uber-like" moving platform. The platform handles booking, tracking, and management of moving jobs for both customers and service providers. The project aims to streamline operations, enhance customer experience, and provide robust administrative tools for managing quotes, jobs, payments, and revenue.

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

The project is structured as a pnpm monorepo. It includes an Express 5 API server and a React web application for Teemer Moving & Storage.

**UI/UX Decisions:**
The web application provides two distinct experiences: an informational marketing site and a moving platform. The admin dashboard is designed for operations control, including detailed job management, revenue reporting, and captain assignment. The captain dashboard is mobile-optimized with large touch targets for on-the-go use.

**Technical Implementations:**
- **Monorepo Tooling**: pnpm workspaces for managing multiple packages.
- **Backend**: Node.js 24 with TypeScript 5.9, using Express 5 for the API.
- **Database**: PostgreSQL with Drizzle ORM for schema definition and interaction.
- **Data Validation**: Zod (`zod/v4`) and `drizzle-zod` for schema validation.
- **API Codegen**: Orval is used to generate API clients and Zod schemas from an OpenAPI specification.
- **Build System**: esbuild for CommonJS bundles.
- **Authentication**: JWT tokens stored in httpOnly cookies for both admin/captain and customer accounts. Role-based access control (`admin`, `move_captain`) is enforced via middleware.
- **Email System**: Centralized email service using Resend, with branded HTML templates and logging to `email_logs` table. Includes automatic triggers for various events (e.g., booking confirmation, status updates). A daily cron job sends day-before reminder emails.
- **Contract Management**: Digital contract signing with customer e-signature capture (canvas signature pad) and PDF generation.

**Key Features:**
- **Quote Management**: Multi-step quote request form, AI box estimation, and deposit payment via Stripe.
- **Job Tracking**: Public-facing job tracking by ID and token, and a lookup page by Job ID and email.
- **Customer Portal**: Self-service account creation, move requests, and job tracking.
- **Provider Portal**: Job marketplace and earnings overview for moving captains.
- **Admin Operations Control Center**: Comprehensive dashboard for managing quotes, jobs, invoices, payments, and user accounts. Includes detailed job views, status timelines, email logs, and an invoice editor.
- **Revenue & Payments Report**: Admin section for detailed revenue tracking, including summary stats, monthly charts, and CSV export.
- **Captain Dashboard**: Mobile-optimized interface for captains to manage assigned jobs, update operational statuses, and add notes. Status changes trigger customer email notifications.

**Business Rules:**
- Automated job creation upon "booked" quote status.
- Server-side enforcement for marking jobs complete (requires $0 remaining balance).
- Atomic creation of payment records and revenue ledger entries for cash payments.
- Auto-calculation of invoice totals and remaining balance.
- Automated piano surcharge calculation based on inventory.

## External Dependencies

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email Service**: Resend (via RESEND_API_KEY)
- **Payment Gateway**: Stripe (Stripe Checkout Sessions, Stripe webhooks)
- **AI Services**: OpenAI (via Replit AI Integrations proxy, falls back to OPENAI_API_KEY)
- **Frontend Libraries**:
    - `react-hook-form`
    - `@hookform/resolvers`
    - `zod`
    - `recharts`
    - `framer-motion`
    - `date-fns`
    - `clsx`
    - `tailwind-merge`