# Changelog

This changelog records meaningful project milestones. It is not a substitute for Git history.

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
