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
Authenticated users can reach Settings and the existing logout flow from a
compact account menu at mobile widths. Business owners can manage a normalized
website and one compressed public logo, and secure confirmation pages show that
public identity without exposing private business contacts. Dashboard summary
tiles navigate to supported customer, booking-filter, business, or insights
destinations. Newly generated confirmation links now open a contextual,
editable sharing flow with native share, WhatsApp, Telegram, copy-message, and
copy-link options; generic Open Graph previews expose only approved public
business identity, and first-open/share-method evidence makes no delivery or
read-receipt claim.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript with strict mode
- Tailwind CSS
- Zod
- Sharp for bounded server-side logo processing
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

Supported values:

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
TRANSACTIONAL_EMAIL_PROVIDER=development
TRANSACTIONAL_EMAIL_FROM=
E2E_AUTH_EMAIL=
E2E_AUTH_PASSWORD=
```

Client-safe values are validated separately from server-only secrets in
`lib/config`.

Booking confirmation email uses the server-only application email abstraction,
not Supabase Auth email. `development` is the safe default and records a
synthetic provider message ID without making an external request. Set
`TRANSACTIONAL_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and
`TRANSACTIONAL_EMAIL_FROM` together to enable real delivery.

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
features/            Implemented and planned feature modules by domain
lib/                 Configuration, service boundaries, validation, utilities
database/            Database notes (migrations live in supabase/migrations)
supabase/migrations/ Immutable PostgreSQL migration source artifacts
docs/                Architecture, development, security, product boundaries
tests/               Unit, integration, and E2E smoke tests
public/              Icons and web manifest
```

## Architecture Principles

- Modular monolith, not microservices.
- Mobile-first responsive application shell.
- Server-side authorization and validation.
- Supabase service-role secrets must never reach the browser.
- Tenant-owned data must be protected by PostgreSQL RLS.
- Business creation and owner membership provisioning must remain atomic and
  tenant-safe.
- Customer records are tenant-owned business data and are not platform auth
  users.
- Booking records are tenant-owned business data attached to tenant-owned
  customers; booking references are not security credentials.
- Customer confirmation links use opaque high-entropy tokens; only token hashes
  are stored, and booking references are not accepted as public credentials.
- Confirmation share text keeps the application-controlled URL separate from
  editable copy. Social metadata uses only public business name/logo, and
  social-preview crawlers do not create customer-view evidence.
- Operational booking state changes use controlled authenticated database RPCs
  and trigger-owned history rather than direct browser-supplied status writes.
- Customer feedback links use a separate scoped token purpose, are available
  only after completion, and store private feedback without public reviews.
- Operational issues are internal tenant records and are not customer-facing.
- Business insights are private tenant aggregates; they must not mix currencies
  or use revenue/accounting terminology.
- Avoid fake payment functionality before the owning phase.
- Every user-uploaded image feature must define and enforce input bytes,
  dimensions, MIME/extension allowlists, server-side content validation,
  optimization, persisted limits, access control, replacement cleanup, and
  deletion behavior. Raw originals are not retained by default.

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
- Documentation governance: `docs/DOCUMENTATION_GOVERNANCE.md`.
- Migration process and ledger: `docs/MIGRATIONS.md`.
- Responsive verification: `docs/RESPONSIVE_QA.md`.
- Continuous integration and merge policy: `docs/CI.md`.

Documentation can describe PLANNED, IMPLEMENTED, or VERIFIED work. Respect those
labels. Documentation is not implementation evidence; inspect repository code,
configuration, migrations, policies, and tests before reporting that something
exists or has been verified.

Documentation is part of definition of done. Material implementation work must
update affected documentation in the same task and follow the change matrix and
pre-finish checklist in `docs/DOCUMENTATION_GOVERNANCE.md`.

## Continuous Integration

GitHub Actions runs Quality, Tests, Build, Dependency Security, and E2E checks
for pull requests into `main` and pushes to `main`. Live runtime security is
defined separately and requires a protected non-production Supabase environment.
See `docs/CI.md` for secrets, required checks, branch protection, and the
explicit no-deployment/no-production-migration boundary.
