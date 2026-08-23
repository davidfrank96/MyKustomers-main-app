# Changelog

This changelog records meaningful project milestones. It is not a substitute for Git history.

## 2026-08-23 - Trusted Customer Confirmation Sharing

Status: VERIFIED

- Replaced naked-link-only handling with a primary contextual sharing dialog,
  editable privacy-safe message, immutable confirmation URL, native system
  share, WhatsApp, Telegram, Copy message, and Copy link.
- Added dynamic canonical Open Graph/Twitter metadata using only valid-link
  state and public business name/logo, with a generic branded image fallback;
  customer/contact/order PII is structurally absent from metadata generation.
- Added tenant-validated `CONFIRMATION_SHARE_INITIATED` audits and an
  idempotent, rate-limited, post-hydration `CONFIRMATION_OPENED` signal. These
  mean method selected and page opened, never provider delivery/read receipt.
- Applied the forward migration to development and verified service-only RPC
  grants, anonymous/authenticated denial, duplicate-open behavior, static and
  live security coverage, dialog utilities, rendered metadata, and the existing
  confirmation lifecycle.
- Added a forward race fix so immediate customer confirmation cannot outrun the
  hydrated first-open signal; used links qualify only when matching immutable
  confirmation evidence exists.

## 2026-08-21 - Mobile Account, Business Identity, And Dashboard Navigation

Status: VERIFIED

- Kept the five-item mobile navigation and added a compact authenticated account
  menu that reaches real Settings and the existing logout route/action.
- Added optional normalized business websites and one owner-managed logo with a
  dedicated route, Sharp server validation, PNG/JPEG/WebP input, 2 MB/6000px/
  25 MP source bounds, aspect-preserving WebP output, and 512px/200 KB persisted
  limits. Raw originals are never stored.
- Added the public logo-only `business-logos` bucket with deterministic tenant
  paths and owner-only Storage RLS for listing, upload, replacement, and delete.
  Removal clears the row before cleanup so a cleanup failure cannot leave a
  broken business reference.
- Added safe public confirmation identity using business name, logo/fallback,
  validated website, and the existing Instagram handle while preserving masked
  confirmation contact and immutable booking terms.
- Added semantic dashboard links: business profile, customers, active/today/
  overdue booking filters, and this-month insights.
- Applied both forward migrations to development. The initial live run found an
  RPC overload ambiguity and masked-email regression; the second migration fixed
  both, and all ten live security suites plus focused responsive/browser flows
  passed without starting billing or the broad redesign.

## 2026-08-21 - Main Reconciliation And CI Quality Gate

Status: VERIFIED

- Reconciled the current verified product branch with the older Phase 9.5 UI
  pass using a normal merge and file-by-file conflict resolution.
- Preserved confirmation contact capture, durable email events, inline customer
  booking, responsive regressions, all applied migrations, and current security
  suites while retaining compatible active navigation, product copy, money,
  next-step, UX-audit, and canonical-journey improvements from `main`.
- Added least-privilege GitHub Actions jobs for quality, tests, build,
  dependency security, E2E, and guarded live runtime security.
- Documented required secret names, branch protection, merge policy, migration
  boundaries, and the separation between CI and deferred production deployment.
- Pull request #2 reported a clean merge state and its remote Quality, Tests,
  Build, Dependency Security, and E2E jobs passed. Runtime Security remains
  intentionally guarded until its protected environment is configured.

## 2026-08-21 - Responsive Alignment And Documentation Governance

Status: VERIFIED

- Audited all current public, auth, onboarding, vendor, confirmation, and
  feedback routes at ten required widths from 320px through 1440px with long
  names, contact values, descriptions, and currency amounts.
- Fixed the inline-customer booking form's implicit grid min-content overflow at
  320px and added maintainable shrink, wrapping, select, dialog, sheet,
  navigation, generated-link, and analytics value constraints.
- Added focused Playwright overflow regressions and lightweight required-doc and
  migration-order governance tests.
- Corrected repository, database, product, architecture, feature, email,
  testing, design, release, and boundary documentation against current code and
  development-schema evidence.
- Made documentation a mandatory same-task definition-of-done requirement and
  added a change matrix, pre-finish checklist, migration ledger, and responsive
  QA record without starting billing, Phase 11, or the broad visual redesign.

## 2026-08-20 - Inline Customer Creation During Booking

Status: VERIFIED

- Added explicit existing-customer and inline-new-customer modes to New Booking,
  with practical active-customer search and minimal name/email/phone fields.
- Added precise discriminated validation and non-blocking, tenant-scoped exact
  name/email/phone duplicate warnings with explicit reuse or continue choices.
- Added authenticated `public.create_booking_with_customer` so both modes use
  one authoritative atomic booking path; inline customer creation, booking,
  trigger history, and required audits commit or roll back together.
- Preserved the non-null same-business customer invariant, active-only booking
  selection, existing confirmation/contact enrichment, booking history, and
  analytics behavior.
- Applied the migration to development and verified static hardening, live RLS
  and rollback attacks, concurrency, desktop/mobile browser journeys, build,
  and dependency audit.

## 2026-08-20 - Customer Contact And Confirmation Email Foundation

Status: VERIFIED

- Required normalized customer-provided email and added optional phone to the
  existing secure booking confirmation action without adding customer accounts.
- Preserved submitted contact on immutable confirmation evidence and enriched
  only empty customer contact fields.
- Added a private durable `BOOKING_CONFIRMED` email outbox event to the atomic
  confirmation transaction, with service-role claiming and bounded delivery
  state/failure metadata.
- Added provider-neutral HTML/plain-text delivery, a no-network development
  adapter, and opt-in Resend configuration.
- Added minimal public form and vendor detail updates plus unit, static, live
  Supabase race/security/failure, and Playwright coverage.

## 2026-08-20 - Engineering Quality and Architecture Review

Status: VERIFIED

- Revalidated the modular-monolith boundaries, Supabase Auth/RLS tenancy model,
  migrations, server actions, query modules, domain types, tests, and dependency
  surface before the page-by-page UI redesign.
- Centralized authenticated current-business enforcement and reused validated
  auth claims across membership checks to remove redundant Auth requests.
- Narrowed customer and booking list projections, consolidated dashboard
  customer hydration, and parallelized independent booking-detail reads.
- Added shared PostgREST filter encoding, opaque-token primitives, and runtime
  security-test setup while preserving feature-specific public token purposes.
- Aligned the custom analytics range guard with the database's five-calendar-
  year contract and added boundary regression coverage.
- Added a narrow follow-up migration so booking completion trends use
  `completed_at` buckets, matching the documented completion-date definition.
- Made no table, RLS, lifecycle, money, analytics definition, dependency, or UI
  design changes.

## 2026-08-19 - Phase 9.5 Product UX, Design, and End-to-End Experience Audit

Status: VERIFIED

- Added `docs/UX_AUDIT.md` with Phase 9.5 findings, evidence, resolutions, and
  status.
- Added active authenticated navigation for Home, Bookings, Customers,
  Insights, and Business across desktop and mobile.
- Improved booking detail hierarchy with a state-specific Next step area for
  lifecycle actions.
- Replaced visible implementation terminology in owner/customer flows with
  product language.
- Updated money formatting so NGN amounts render naturally, for example
  `₦45,000`, while preserving integer minor-unit storage.
- Strengthened the booking E2E into a canonical journey covering customer
  creation, booking creation, customer confirmation, fulfilment, feedback,
  issue handling, and insights.
- Completed responsive visual audit across mobile, tablet, and desktop
  viewports without adding billing, payment processing, messaging automation,
  exports, or staff management.

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
