# My Kustomers

My Kustomers is a mobile-first SaaS application for small businesses that manage
customers, bookings, orders, confirmations, feedback, and customer history through
informal channels today.

Delivery-to-feedback automation is implemented in the repository and its exact
additive migration is verified on the configured Production-backed database.
Delivery atomically creates or recovers one private feedback request linked to
the durable delivery event; manual sharing returns the same request, and paid
plus feedback completes a delivered booking in either arrival order. A temporary
forward compatibility migration keeps the legacy deployed delivery RPC working
while preserving strict validation for every non-null version 1 event/link
association. Legacy and new rollback-only Production database paths, forged-v1
denial, tenant isolation, and zero residue are verified. The complete local
desktop/mobile/PWA browser matrix is green; PR, CI, application deployment, and
controlled Production provider verification remain release gates.

Production observability is now implemented with the current Sentry Next.js SDK
for error capture, conservative 5% tracing, release identification, and private
source-map upload. A centralized fail-closed sanitizer removes capability
tokens, queries, identity/contact data, headers, cookies, bodies, local
variables, and unsafe breadcrumbs. Replay, feedback, profiling, logs, metrics,
and routine local/CI transmission remain disabled. Production source-map and
controlled-event verification are pending; see `docs/SENTRY.md`.

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
website and one compressed public logo. The shared browser flow accepts
supported sources up to 5 MiB and reduces risky large requests before upload,
while the server remains authoritative for validation and the final 512px/
200 KiB WebP. PR #37 and Production merge `dd0fe2c` verified exact-5 MiB
onboarding, constrained-mobile replacement, >5 MiB no-request rejection, and
zero-fixture cleanup. Secure confirmation pages show that public identity without
exposing private business contacts. Dashboard summary
tiles navigate to supported customer, booking-filter, business, or insights
destinations. Newly generated confirmation links now open a contextual,
editable sharing flow with native share, WhatsApp, Telegram, copy-message, and
copy-link options; generic Open Graph previews expose only approved public
business identity, and first-open/share-method evidence makes no delivery or
read-receipt claim.
Completed-booking feedback links now use the same trusted sharing model with
private, no-account-required copy, crawler-safe business-only metadata,
idempotent first-open evidence, and truthful share-method audit events. Major
authenticated routes provide neutral structural loading states, tenant switches
hide the prior workspace while navigation is pending, and authenticated context
reads are deduplicated only within one server request. Public capability routes
remain explicitly non-cacheable.
Authentication and workspace authorization now converge through a shared server
boundary: active `business_members` is resolved before any vendor shell renders,
and zero-business users receive a shell-free `/onboarding` route regardless of
password/Google provider, vendor `next`, forged cookie, or previous membership.
Query failures fail closed; page/action checks and RLS remain defence in depth,
and active Platform Admin access keeps its independent role gate.
Authenticated Navigation Performance V2 adds immediate accessible pending state
to desktop/mobile product navigation and names each destination in its loading
shell. Bookings and Customers stream authorized controls before paginated rows;
customer feedback and booking operational issues are bounded secondary streams.
Default Next prefetch remains unchanged, and there is still no persistent tenant
cache or service worker for private data. PR #41 passed every required executable
check, merged conflict-free as `d2f55fd`, deployed to Vercel Production, and
passed controlled desktop, mobile, standalone, and Nigeria-profile verification
before all temporary production fixtures were removed.
Authenticated PWA lifecycle reliability now treats long suspension, persisted
page restoration, and reconnection as freshness boundaries. A single
shell-level coordinator performs bounded server reconciliation, defers while a
form or dialog is unsafe to refresh, retries only held same-origin navigation,
and never queues mutations. Booking polling is reduced to one visible-tab check
every 10 seconds and shares the same resume path. There is still no service
worker or private authenticated cache. See `docs/PWA_RELIABILITY.md` for the
platform evidence and physical-iOS verification limitation. PR #43 passed all
required executable checks, merged as `b0bd805`, deployed to Production, and
passed controlled canonical Chromium/WebKit/app-window smoke with zero final
fixture residue.
Accounts with one or more active business memberships can also review their
workspaces, roles, and explicit current-business state on the Business page and
switch there through the same server-authorized action as the header quick
switcher. Login and signup include application support for Supabase Google OAuth;
the configured project now reports Google enabled and both controls are active.
A real Google-to-Supabase round trip succeeded, and the application callback,
profile trigger, zero-business onboarding, persistent session, and logout were
verified through the normal local callback. The same controlled Google session
then created one and two-business states, resolved the current workspace,
switched businesses, persisted after refresh, and logged out cleanly. The merged
production deployment completed the same Google callback, two-business
resolution, switching, persistence, logout, and protected-route checks.
Email/password authentication remains fully supported.
Google sign-in now deliberately requests Google's account chooser on every
start with `prompt=select_account`; it does not force renewed consent. Password
recovery is accepted only after the canonical Supabase PKCE callback establishes
both an authenticated session and a short-lived HTTP-only recovery intent. A
successful password change consumes that intent, signs the session out, and
requires login with the new password.

Bookings and Customers now return 25 tenant-scoped records initially and append
another bounded 25 through an explicit Load more control. Search and filters
remain URL-addressable, while appended state is local to the current
business/query. Deterministic `(created_at, id)` cursors prevent duplicates or
skips when records are inserted between requests; every appended request derives
the user and current business on the server.
Customer-confirmed material booking terms are now database-locked against
ordinary edits. Explicit rescheduling remains the current reconfirmation
workflow, internal notes remain editable before terminal states, and confirmed
cancellation atomically preserves confirmation evidence while creating one
durable customer cancellation email event.
Confirmed and in-progress bookings now also support explicit customer-approved
amendments. A pending amendment preserves structured current/proposed terms and
does not mutate the booking; a purpose-specific 24-hour link applies the change
atomically only after customer confirmation. Stale, revoked, expired,
wrong-purpose, and cross-tenant requests are denied, while original confirmation
and amendment evidence remain reconstructable.
Confirmed and in-progress bookings also support linked add-ons for genuinely new
scope. Draft and awaiting-customer add-ons do not change booking totals; only
customer-confirmed add-ons contribute to derived current value, deposit, balance,
and analytics. Add-ons inherit the parent currency and current delivery schedule,
use a separate 24-hour hash-only confirmation capability, and never rewrite the
original booking or amendment evidence.
Booking detail now presents the persisted lifecycle as a server-derived vendor
journey: Booking created, Customer confirmation, Work in progress, Ready for
delivery, Delivered, Payment & completion, and the derived post-completion
Feedback step.
Every non-terminal state identifies either its one valid next action or why it
is waiting. New customer confirmations preserve `CONFIRMED` evidence and then
advance atomically to `IN_PROGRESS`; the normal Start work action is removed.
Legacy `CONFIRMED` rows are not rewritten and retain backend transition
compatibility.

Booking payments are private append-only records of money the vendor reports as
received outside My Kustomers. Authoritative payment totals include the initial
booking deposit, confirmed add-on deposits, and subsequent `booking_payments`
exactly once. Completion is denied while the currency-specific outstanding
balance is positive. The product does not process, verify, refund, or correct
payments in this version.

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

## Production Deployment

The canonical Vercel deployment is live at `https://mykustomers.com`, with
`https://www.mykustomers.com` permanently redirecting to the apex. The retained
`https://my-kustomers-main-app.vercel.app` hostname continues to work. Vercel deploys the `main` branch of
`davidfrank96/MyKustomers-main-app`; GitHub Actions remains the pre-merge quality
gate and does not itself deploy or apply database migrations.

Production is configured for Brevo behind the provider-neutral outbox, with a
scoped Resend key retained as standby and no automatic failover. A controlled
booking-confirmation event was accepted by Brevo, reached the controlled inbox,
and appeared truthfully in Admin Email Operations.
Supabase Auth SMTP is a separate path. Production custom SMTP is enabled with
the verified My Kustomers sender through Brevo; controlled signup confirmation,
recovery, password update, and new-password login all passed. See
`docs/DOMAIN_EMAIL_INFRASTRUCTURE.md`, `docs/TRANSACTIONAL_EMAIL.md`, and
`docs/DEPLOYMENT.md`.

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
BREVO_API_KEY=
RESEND_API_KEY=
TRANSACTIONAL_EMAIL_PROVIDER=development
TRANSACTIONAL_EMAIL_FROM=
E2E_AUTH_EMAIL=
E2E_AUTH_PASSWORD=
```

Client-safe values are validated separately from server-only secrets in
`lib/config`.

Booking, cancellation, amendment, and add-on email use the server-only
application email abstraction, not Supabase Auth email. `development` is the
safe default and records a synthetic provider message ID without making an
external request. Brevo requires `TRANSACTIONAL_EMAIL_PROVIDER=brevo`,
`BREVO_API_KEY`, and `TRANSACTIONAL_EMAIL_FROM`; Resend requires
`RESEND_API_KEY` when selected. External credentials are server-only and Production values
must not be copied into Preview or Development by default.

`E2E_AUTH_EMAIL` and `E2E_AUTH_PASSWORD` are optional local test credentials for
real Supabase authentication E2E tests. Do not commit real values.

`E2E_SIGNUP_EMAIL` is optional and must point at a safe inbox before running
default Supabase email confirmation tests. The E2E test derives plus-addressed
test aliases from this value.

Google OAuth provider credentials are not application environment variables.
They belong in the Supabase Auth Google provider configuration and must never be
committed or added to Vercel. See `docs/DEPLOYMENT.md` for the required callback
and provider configuration names.

`PHASE2_RUNTIME_VERIFICATION=1` and `PHASE2_SUPABASE_TARGET=local|development|test|staging`
opt in to mutating Phase 2 Supabase runtime security tests. These tests also
require the Supabase URL, publishable key, and service-role key above, and should
only be pointed at a non-production database. The runtime script also includes
Phase 3 business onboarding, Phase 4 customer security, Phase 5 booking
security, Phase 6 confirmation-link security, Phase 7 operational lifecycle
security, Phase 8 feedback/issue security tests, and Phase 9 analytics security
tests, plus confirmed-booking integrity, cancellation race, amendment, and
booking add-on coverage.

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
- Once customer-confirmed, material booking terms cannot be silently edited.
  Explicit rescheduling invalidates current confirmation and requires
  reconfirmation; cancellation preserves the original evidence. General
  material changes use a separate pending amendment and atomic customer
  approval, never a temporary canonical booking state.
- New scope uses separate immutable confirmed add-on records. Pending add-ons do
  not affect totals, and an independently scheduled item must be a new booking.
- Customer feedback links use a separate scoped token purpose, are available
  only after completion, and store private feedback without public reviews.
- Feedback sharing records intent and first browser open separately; it does not
  claim delivery, reading, or submission, and social-preview crawlers cannot
  create first-open evidence.
- Authenticated and tenant-scoped reads may be memoized within one server
  request, but may not use persistent caches without an explicit scope, key,
  invalidation plan, and cross-tenant security analysis.
- Operational issues are internal tenant records and are not customer-facing.
- Business insights are private tenant aggregates; they must not mix currencies
  or use revenue/accounting terminology.
- Never describe booking value as payments received. Payment records describe
  vendor-entered receipts only and do not claim processing or verification.
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
- Platform-admin threat model and bootstrap: `docs/ADMIN_SECURITY.md`.
- Privileged admin action framework: `docs/ADMIN_PRIVILEGED_ACTIONS.md`.
- Responsive verification: `docs/RESPONSIVE_QA.md`.
- Continuous integration and merge policy: `docs/CI.md`.
- Vercel deployment and rollback runbook: `docs/DEPLOYMENT.md`.

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
GitHub Actions does not deploy; the separately configured Vercel Git integration
deploys merged `main` commits and never applies database migrations. See
`docs/CI.md` and `docs/DEPLOYMENT.md`.

## Multi-Business Accounts

Authenticated accounts may belong to multiple businesses through
`business_members`. The shared desktop/mobile header restores a server-validated
HTTP-only current-business preference, falls back safely when that membership is
missing, and can create another owner workspace through the existing atomic
onboarding RPC. Customers, bookings, insights, searches, and business settings
then use that resolved business. The preference is never authorization, and no
`profiles.business_id` shortcut exists.

## Platform Administration

Admin Phase 0/1 is verified in production. Platform
authority is stored in a dedicated `platform_admins` model and is permanently
separate from tenant `business_members` roles. The server-protected `/admin`
namespace admits only an `ACTIVE SUPER_ADMIN`; ordinary,
single-business, multi-business, anonymous, disabled, and client-forged callers
are denied. The approved existing Auth identity is the sole active production
administrator, and a live disable/re-enable round trip proved next-request
revocation and audit evidence without exposing identity data or credentials.

Admin Phase 2 adds a read-only, aggregate-only operations overview for platform
scale, booking state, open issues, and email outbox state. One narrow
server-authorized RPC returns counts only; it is independent of current-business
selection and exposes no customer PII, financial totals, record browser, or
mutation. Admin Phase 2 is verified in production from merge commit `22e6617`;
the authenticated overview, active authorization, stable domain, and clean
runtime logs passed. See `docs/ADMIN_SECURITY.md`.

Admin Phase 3 implements read-only Businesses and Users support directories and
detail routes. Four narrow database projections recheck active `SUPER_ADMIN`
authority and return allowlisted business, membership, aggregate, profile, and
Auth identity fields only. Search is server-side and literal, pages contain 20
records, business rows aggregate counts without N+1 calls, and business/user
details cross-link. Raw Auth objects, tokens, customer lists, booking details,
service-role browser access, impersonation, suspension, editing, and deletion
remain absent. Production-safe SQL reconciliation and a temporary zero-business
admin browser journey verified the implementation. PR #15 merged as `4437a161`;
Vercel deployed that exact `main` commit and the production read-only smoke,
session, responsive, and cleanup checks passed.

Admin Phase 4 is verified in production from PR #17 and merge `edbef26`.
Approved migration
`20260825022135_platform_admin_read_only_booking_issue_operations.sql` is applied
to the production-backed Supabase project and its ownership, grants, internal
authorization, real-data projections, and anonymous denial are verified. It adds read-only Bookings and Issues
directories/details through four active-admin-only RPCs. Directory search is
bounded and excludes contact/private text; detail projections mask confirmation
contacts and omit internal notes, raw terms, tokens, feedback comments, email
recipients, provider payloads, and failure payloads. Customer browsing,
impersonation, suspension, editing, and deletion remain deferred.
All eight PR checks passed, Vercel deployed the exact merge commit, and the
authenticated production booking/issue directory and detail smoke passed with
no browser warning or error diagnostics.

Admin Phase 5 implements a read-only `/admin/emails` operations surface over the
existing transactional outbox. It uses the persisted `PENDING`, `SENDING`,
`SENT`, and `FAILED` states, defaults to the last seven days, and exposes only
business/booking context, timestamps, attempt counts, and controlled failure
categories. `SENT` means adapter or provider acceptance, never recipient
delivery, opening, or reading. Recipient masking is detail-only; message bodies,
provider identifiers, raw failures, credentials, retry, and resend are excluded.
The forward RPC migration is applied to the production-backed project and its
grants, authorization, minimized projections, immutable reads, and temporary
account cleanup are runtime verified. PR #19 passed its required checks and
merged as `52a1820`; Vercel deployed that exact commit and authenticated
production summary/list/detail smoke passed over existing live events without
creating email or domain fixtures.

Admin Phase 6A implements the mandatory MFA and privileged-action framework
without enabling an admin write. `/admin/security` uses native Supabase TOTP for
active platform admins. Existing reads retain their current authorization;
future writes must additionally pass `requirePrivilegedPlatformAdmin()` with a
signature-verified AAL2 session, current `ACTIVE` role, explicit confirmation,
action-specific validation, required reason where applicable, audit evidence,
and regression coverage. Vendors are not required to enroll MFA. Phase 6A did
not enable a write; Phase 6B's separately reviewed failed-email retry is
described below and every other privileged mutation remains deferred.
Controlled production-backed verification used a temporary zero-business admin
to prove enrollment, invalid-code denial, challenge/verify, AAL2, immediate
disabled-admin denial, logout/login assurance reset, and cleanup. PR #27 passed
all required executable checks, merged conflict-free as `b90ab5f`, and Vercel
deployed that exact `main` commit. Authenticated production smoke verified the
Security page, session persistence, read-only admin navigation, vendor onboarding
resolution, security headers, and 390/768/1024/1440 containment. The approved
production admin was not enrolled or modified.

Admin Phase 6B implements the first and only privileged write: manual retry of
a safely classified failed transactional email. An active `SUPER_ADMIN` must be
at AAL2, provide a bounded reason, and confirm in the application dialog. The
server re-derives eligibility and the database atomically locks the same logical
event; one provider-pinned attempt is appended without erasing prior evidence.
Only proven 429, pre-submission connection, or unaccepted 5xx failures are
retryable. Ambiguous outcomes, permanent/configuration/recipient failures, and
`PENDING`, `SENDING`, or `SENT` events cannot be retried. There is no provider
switch, automatic failover, bulk retry, recipient/content editing, or domain
state mutation.

Admin Phase 7 implements read-only Security & Health at `/admin/security`.
Active platform admins can inspect deterministic platform status, bounded
database/authentication/email evidence, operational exceptions, minimized
security activity, administrator resilience, MFA status, and safe deployment
context. One health-summary RPC and one bounded activity RPC independently
repeat active-admin authorization; AAL1 may read, while Phase 6B writes still
require AAL2. Missing evidence is `UNKNOWN`, provider acceptance is not called
delivery, and no refresh, page load, or detected anomaly can mutate production.
The source/freshness/privacy contract is in `docs/ADMIN_SECURITY_HEALTH.md`.
Admin Phase 7 is verified in production from PR #39 and merge `d5bfb8f`; the
planned foundational admin roadmap is complete without beginning Admin Phase 8.

## Live Booking Communication Detour

Booking detail now checks a protected, tenant-filtered minimal state snapshot
while the page is visible. Customer confirmation and private feedback submitted
in another tab refresh the existing server-rendered page and show an in-app
toast; polling pauses in background tabs and stops on navigation. This is not a
Realtime publication, browser push, offline cache, or source of domain truth.

Confirmed reschedules and the `DELIVERED` transition create durable
`BOOKING_RESCHEDULED` and `BOOKING_DELIVERED` outbox events in their domain
transactions. Brevo remains primary, Resend remains standby, and one event still
selects one provider. Booking emails use a stable booking subject family plus
opaque correlation headers. Standard `Message-ID`/`In-Reply-To` chaining is not
claimed because the active Brevo API does not support those standard headers.

Booking completion now uses an accessible application-owned confirmation
dialog. The final `DELIVERED -> COMPLETED` mutation runs only after confirmation
inside My Kustomers; browser-native confirm, alert, and prompt dialogs are not
lifecycle dependencies. New first and additional business setup also requires
one successfully persisted optimized logo before the workspace is selected and
setup is considered complete. The existing owner-authorized logo API,
validation, WebP optimization, deterministic path, Storage RLS, and public
fallback remain unchanged. Existing legacy businesses without logos remain
usable. No migration is included.

PR #23 passed Quality, Tests, Build, E2E, and Dependency Security and merged
conflict-free as `9dae103`. Vercel deployed that exact `main` commit. A
controlled production Auth user verified no-logo rejection without row
creation, optimized first/additional-business logo persistence, workspace
switching, booking completion cancel/final confirmation at 320px, feedback
guidance, and logo replace/remove/restore. Cleanup confirmed zero temporary
Auth-user or business leftovers.
