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

**Platform:**
- `/platform` — Platform entry
- `/platform/customer` — Customer portal (Request Move + Track Job tabs)
- `/platform/provider` — Provider portal (Job Marketplace, Earnings)

**Admin:**
- `/admin` — Admin Operations Control Center (stats, revenue chart, job table, dispatch map)

### Company Details
- **Name**: Teemer Moving & Storage Co.
- **Phone**: (516) 269-3724
- **Location**: Long Beach, NY 11561
- **Service Areas**: Long Beach, Nassau County, Suffolk County, Manhattan, Queens, Brooklyn

### Database Schema
- `quote_requests` — Customer move quote requests
- `jobs` — Moving jobs (assigned from quotes)
- `contacts` — Contact form submissions

### API Endpoints
- `GET/POST /api/quotes` — Quote requests
- `GET/POST /api/jobs` — Jobs
- `GET/PATCH /api/jobs/:jobId` — Individual job + status updates
- `POST /api/contact` — Contact form
- `GET /api/admin/stats` — Admin dashboard stats

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
