# Changelog

This changelog records meaningful project milestones. It is not a substitute for Git history.

## 2026-08-19 - Phase 9 Business Insights and Analytics

Status: VERIFIED

- Added Phase 9 migration for analytics-oriented indexes and
  `public.get_business_insights`, plus a follow-up fix for the applied RPC
  timestamp variable name.
- Added authenticated `/insights` with tenant-private customer, booking,
  value, operational, feedback, and issue metrics based on persisted records.
- Added supported date ranges for this month, last month, last 30 days, this
  year, and validated custom ranges, with previous equivalent period
  comparisons.
- Documented metric definitions and conservative financial terminology.
  Recorded/completed booking value is grouped by currency and is not presented
  as revenue, cash, profit, tax, or accounting output.
- Added dashboard monthly insights summary without changing operational queues.
- Added analytics domain tests, static Phase 9 migration/security tests, live
  Supabase aggregate-isolation tests, and Playwright insights coverage.

## 2026-08-19 - Phase 8 Private Feedback and Operational Issues

Status: VERIFIED

- Added Phase 8 migration for `feedback_links`, `feedback`, `booking_issues`,
  issue enums, feedback RPCs, integrity triggers, RLS policies, grants, and
  feedback/issue audit events.
- Added vendor feedback link generation, regeneration, and revocation for
  completed bookings without existing feedback. Raw feedback URLs are shown
  once; only token hashes are stored.
- Added public `/f/[token]` feedback pages with minimized booking data,
  no-store/noindex/referrer protections, persistent hashed rate limiting, safe
  unavailable/submitted states, and POST-backed private feedback submission.
- Added immutable private feedback display on booking detail and customer
  detail pages.
- Added internal operational issue create/resolve UI on booking detail pages
  with tenant RLS and terminal resolution semantics.
- Added feedback domain tests, static Phase 8 migration/security tests, runtime
  Supabase feedback/issue security tests, and Playwright coverage for feedback
  submission and issue lifecycle.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-19 - Phase 7 Fulfilment and Operational Booking Lifecycle

Status: VERIFIED

- Added Phase 7 migration for operational booking timestamps, cancellation
  reasons, `booking_changes`, controlled lifecycle/reschedule RPCs, updated
  booking integrity triggers, RLS, grants, and operational indexes.
- Blocked direct authenticated browser status writes and routed vendor
  lifecycle changes through `transition_booking_status` with tenant membership
  checks, row locking, valid transition enforcement, database-managed
  timestamps, trigger-owned status history, and audit events.
- Added rescheduling before fulfilment through `reschedule_booking`; confirmed
  reschedules invalidate current customer confirmation, revoke open links,
  record focused change history, and require reconfirmation.
- Added dashboard/list operational queues for due today, overdue, in-progress,
  and ready bookings.
- Added booking detail controls for start work, mark ready, mark delivered,
  complete, cancel with reason, reschedule, operational timestamp summary, and
  combined status/change timeline.
- Added Phase 7 domain tests, static migration/security tests, runtime
  Supabase operational lifecycle tests, and Playwright
  create-confirm-reschedule-reconfirm-complete coverage on desktop and mobile.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-19 - Phase 6 Secure Customer Confirmation Links

Status: VERIFIED

- Added Phase 6 migration for `confirmation_links`,
  `booking_confirmations`, persistent `confirmation_rate_limits`,
  `AWAITING_CUSTOMER` lifecycle state, booking confirmation terms fields,
  server-only public confirmation RPCs, and updated booking integrity triggers.
- Added vendor link generation, regeneration, and revocation UI on booking
  detail pages. Raw confirmation URLs are shown once; only token hashes are
  stored.
- Added public `/c/[token]` confirmation pages with minimized booking data,
  no-store/noindex/referrer protections, safe status messages, non-consuming
  GET views, and POST-backed customer confirmation.
- Added immutable confirmation terms snapshots/hashes and material-change
  invalidation so confirmed terms are not silently rewritten.
- Added persistent hashed rate-limit buckets for public confirmation lookup and
  confirmation actions.
- Added confirmation-link unit tests, static migration/security tests, runtime
  Supabase confirmation security tests, and E2E customer confirmation coverage
  on desktop and mobile.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-18 - Phase 5 Booking Engine

Status: VERIFIED

- Added Phase 5 migration for `bookings`, `booking_status_history`, booking
  status and currency enums, generated immutable booking references, indexes,
  RLS policies, grants, integrity triggers, and booking audit events.
- Added tenant-scoped booking list with search, status/upcoming/overdue filters,
  pagination, customer association, and booking counters on the dashboard.
- Added booking create, detail/edit, money summary, status transition, terminal
  lock, and status history views using server actions and Zod validation.
- Stored booking money as integer minor units and derived balance at read/display
  time; documented the ADR.
- Deferred booking items, confirmation links, customer-facing booking tokens,
  payment processing, feedback, and analytics expansion.
- Added booking domain tests, static migration/RLS tests, runtime Supabase
  booking security tests, and E2E create/edit/transition/cancel coverage.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-18 - Phase 4 Customer Management

Status: VERIFIED

- Added Phase 4 migration for `customers`, customer constraints, indexes,
  timestamp trigger, immutable `business_id` trigger, RLS policies, grants, and
  customer audit events.
- Added tenant-scoped customer list with search, active/archived/all filters,
  pagination, and real customer count on the dashboard.
- Added customer create, detail/edit, and archive flows using server actions and
  Zod validation.
- Added duplicate contact warning strategy without enforcing unique customer
  names, email addresses, or phone numbers.
- Added customer validation tests, static migration/RLS tests, runtime Supabase
  tenant security tests, and E2E create/edit/archive coverage.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-18 - Phase 3 Business Onboarding

Status: VERIFIED

- Added Phase 3 migration for business profile fields, slug/category
  constraints, onboarding completion state, and `BUSINESS_UPDATED` audit events.
- Added narrow authenticated `create_business_onboarding` RPC for atomic
  business and owner membership creation using `auth.uid()`.
- Added `/onboarding` for authenticated no-business users and redirected normal
  tenant dashboard functionality until a business exists.
- Added `/business` profile/settings screen with owner-only updates for Phase 3
  fields.
- Updated dashboard context to show real business name, slug, category, and
  honest future-feature empty states.
- Added business validation, runtime Supabase onboarding security tests, and E2E
  onboarding journey tests.
- Verified lint, typecheck, unit/integration tests, runtime security tests, E2E,
  production build, and dependency audit.

## 2026-08-18 - Phase 2 Authentication and Multi-Tenancy Foundation

Status: IMPLEMENTED - VERIFICATION PENDING

- Added an opt-in Phase 2 runtime Supabase RLS/security test scaffold for
  controlled dev/test verification. Phase 2V later applied the migration to the
  configured development Supabase database and verified live RLS, tenant
  isolation, grants, helper functions, audit boundaries, login/session/logout,
  route protection, and redirect safety. Public signup remained PARTIAL because
  the configured Supabase project hit email constraints and no safe default-email
  inbox was configured; reset-password completion remained PARTIAL pending
  recovery email/token verification.
- Added Supabase migration for profiles, businesses, business memberships, audit logs, enums, triggers, helper functions, grants, RLS, and policies.
- Added Supabase SSR proxy session refresh support.
- Added email/password signup, login, logout, forgot-password, reset-password, and auth callback routes.
- Added protected vendor route group behavior and no-business interim state.
- Added server-side authorization helpers for user and business membership checks.
- Added server-only service-role audit helper and minimal business creation helper.
- Added Phase 2 unit, static security, migration, and E2E smoke tests.
- Runtime Supabase migration application and RLS isolation tests pass.

## 2026-08-18 - Phase 1.5 Project Governance and Planning

Status: VERIFIED

- Added master plan, product specification, phase roadmap, ADRs, conceptual data model, design system guidance, testing strategy, release checklist, and changelog.
- Formalized PLANNED, IMPLEMENTED, and VERIFIED status meanings.
- Added the rule that documentation is not implementation evidence.
- Added architecture conflict handling rules.
- Strengthened security invariants with stable SEC IDs.
- Confirmed Phase 2 functionality remained PLANNED and unimplemented at the end of Phase 1.5.

## 2026-08-18 - Phase 1 Repository Foundation

Status: VERIFIED

- Established Next.js 16 App Router foundation.
- Enabled strict TypeScript, ESLint, Tailwind CSS, Vitest, Playwright, and production build scripts.
- Created responsive public and vendor dashboard shells.
- Added shared UI primitives and layout components.
- Added typed environment handling and Supabase client/server boundaries.
- Added PWA manifest and icons.
- Added initial README, architecture, development, security, product boundaries, and database notes.
- Verified install, lint, typecheck, tests, E2E smoke tests, production build, and dependency audit.
