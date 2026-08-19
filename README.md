# My Customers

My Customers is a mobile-first SaaS application for small businesses that manage
customers, bookings, orders, confirmations, feedback, and customer history through
informal channels today.

This repository has completed Phase 9: business insights and analytics. Phase 2 remains
implemented with verification pending only for default-email signup confirmation
and reset-password delivery. Supabase database, RLS, tenant isolation, grants,
service-role boundaries, route protection, business onboarding, and owner
business profile updates, tenant-scoped customer management, and tenant-scoped
booking management, confirmation-link security, operational booking lifecycle
controls, private feedback, and operational issue records have runtime
verification evidence. Private tenant analytics are derived from stored records
with currency-specific value grouping and documented metric definitions.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript with strict mode
- Tailwind CSS
- Zod
- Supabase PostgreSQL, Auth, and Storage boundaries
- Vitest
- Playwright
- ESLint and Prettier

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The local app runs at `http://localhost:3000` by default.

## Environment

Tracked examples live in `.env.example`. Do not commit real secrets.

Expected future values:

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
E2E_AUTH_EMAIL=
E2E_AUTH_PASSWORD=
```

Client-safe values are validated separately from server-only secrets in
`lib/config`.

`E2E_AUTH_EMAIL` and `E2E_AUTH_PASSWORD` are optional local test credentials for
real Supabase authentication E2E tests. Do not commit real values.

`E2E_SIGNUP_EMAIL` is optional and must point at a safe inbox before running
default Supabase email confirmation tests. The E2E test derives plus-addressed
test aliases from this value.

`PHASE2_RUNTIME_VERIFICATION=1` and `PHASE2_SUPABASE_TARGET=local|development|test|staging`
opt in to mutating Phase 2 Supabase runtime security tests. These tests also
require the Supabase URL, publishable key, and service-role key above, and should
only be pointed at a non-production database. The runtime script also includes
Phase 3 business onboarding, Phase 4 customer security, Phase 5 booking
security, Phase 6 confirmation-link security, Phase 7 operational lifecycle
security, Phase 8 feedback/issue security tests, and Phase 9 analytics security
tests.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:security:runtime
npm run test:e2e
npm run build
```

## Repository Structure

```text
app/                 Next.js App Router route groups and route handlers
components/          UI primitives, layout components, shared composition
features/            Future feature modules by domain
lib/                 Configuration, service boundaries, validation, utilities
database/            Migration location and database notes
docs/                Architecture, development, security, product boundaries
tests/               Unit, integration, and E2E smoke tests
public/              Icons and web manifest
```

## Architecture Principles

- Modular monolith, not microservices.
- Mobile-first responsive application shell.
- Server-side authorization and validation.
- Supabase service-role secrets must never reach the browser.
- Future tenant-owned data must be protected by PostgreSQL RLS.
- Business creation and owner membership provisioning must remain atomic and
  tenant-safe.
- Customer records are tenant-owned business data and are not platform auth
  users.
- Booking records are tenant-owned business data attached to tenant-owned
  customers; booking references are not security credentials.
- Customer confirmation links use opaque high-entropy tokens; only token hashes
  are stored, and booking references are not accepted as public credentials.
- Operational booking state changes use controlled authenticated database RPCs
  and trigger-owned history rather than direct browser-supplied status writes.
- Customer feedback links use a separate scoped token purpose, are available
  only after completion, and store private feedback without public reviews.
- Operational issues are internal tenant records and are not customer-facing.
- Business insights are private tenant aggregates; they must not mix currencies
  or use revenue/accounting terminology.
- Avoid fake payment functionality before the owning phase.

See `docs/architecture.md`, `docs/security.md`, `docs/development.md`, and
`docs/product-boundaries.md` for the project rules that future phases should
preserve.

## Project Governance

The repository documentation is the source of truth for future implementation:

- Master plan: `docs/MASTER_PLAN.md`.
- Product specification: `docs/PRODUCT_SPEC.md`.
- Phase status and roadmap: `docs/PHASES.md`.
- Architecture decisions: `docs/DECISIONS.md`.
- Security invariants: `docs/security.md`.
- Conceptual data model: `docs/DATA_MODEL.md`.
- Testing strategy: `docs/TESTING.md`.
- Analytics definitions: `docs/ANALYTICS_DEFINITIONS.md`.

Documentation can describe PLANNED, IMPLEMENTED, or VERIFIED work. Respect those
labels. Documentation is not implementation evidence; inspect repository code,
configuration, migrations, policies, and tests before reporting that something
exists or has been verified.
