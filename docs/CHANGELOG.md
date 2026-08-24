# Changelog

## 2026-08-24 - Trusted Feedback Sharing, Structural Loading, And Cache Governance

Status: VERIFIED

- Extended completed-booking private feedback requests with the existing trusted
  sharing interaction: native share, WhatsApp, Telegram, copy message, and copy
  link, using contextual no-account-required copy and one controlled URL.
- Added tenant-validated `FEEDBACK_SHARE_INITIATED` evidence and idempotent
  service-only `FEEDBACK_OPENED` evidence without claiming provider delivery,
  customer reading, or submission.
- Added crawler-safe business-only metadata and generic preview shells while
  preserving purpose separation, no-store responses, hash-only token storage,
  and cross-tenant denial.
- Added accessible, reduced-motion-safe structural loading states to major
  authenticated routes and an opaque pending overlay that prevents stale
  workspace data from remaining visible during business switching.
- Deduplicated authenticated user and current-business resolution within each
  React server request. No persistent tenant cache, Redis, speculative index, or
  global analytics cache was introduced; measured query plans supported the
  existing indexes.
- Added unit, component, static migration, live runtime-security, and responsive
  desktop/mobile browser regressions. Detailed measurement and cache policy live
  in `docs/PERFORMANCE.md`.
- Final gates passed: lint, strict typecheck, 46 ordinary Vitest files with 195
  tests, 13 live runtime files with 14 tests, 34 Playwright journeys with 6
  intentional skips, production build, moderate dependency audit, database lint,
  and `git diff --check`.

## 2026-08-24 - Business Switcher Discoverability And Google Auth Support

Status: VERIFIED - PRODUCTION

- Added a Business-page `My businesses` section with active membership identity,
  owner/member role, textual current state, shared secure switching, and the
  existing additional-business route across mobile and desktop.
- Kept the header quick switcher and made its current state textual without
  adding a mobile navigation destination or changing tenant authority.
- Added one reusable Supabase Google OAuth control/action to login and signup,
  reusing the existing PKCE callback, profile trigger, onboarding, business
  resolution, logout, and safe redirect boundaries.
- Added safe provider/callback errors and a disabled-provider state. The current
  project now reports Google enabled; real Google authorization reached Supabase,
  completed through the normal local callback, and covered profile provisioning,
  zero-business onboarding, persistence, logout, and protected-route denial.
- The same Google session verified one and multiple-business routing, current
  workspace resolution, switching, and refresh persistence. Required CI passed,
  the merge deployed successfully, and production OAuth repeated the callback,
  multi-business resolution, switching, persistence, logout, and protected-route
  checks. Same-email identity behavior remains a separate lifecycle check.
- Excluded the exact OAuth callback route from Next.js development incoming-request
  logs so transient authorization-code query strings are not printed; ordinary
  development request logging remains enabled.
- Added no database migration, dependency, Google secret, Vercel variable, or
  additional identity store.

## 2026-08-24 - Multi-Business Account Support And Business Switching

Status: VERIFIED

- Added server-validated HTTP-only current-business preference with safe
  deterministic fallback for missing or revoked memberships.
- Added one responsive authenticated-shell switcher and `/business/new`, reusing
  atomic onboarding and preserving the five-item mobile navigation.
- Preserved membership-specific owner/member authorization across customers,
  bookings, insights, business settings, search, and booking creation.
- Added and applied forward migration
  `20260824094523_select_current_business_for_booking_creation.sql`, requiring
  exact active membership for atomic booking creation.
- Added a fail-closed legacy RPC wrapper for deployment-order compatibility: it
  delegates only for exactly one active membership and rejects multi-business
  ambiguity.
- Added unit, static migration, live Supabase, desktop/mobile E2E, forged-input,
  stale preference, revocation, and responsive regression coverage.

This changelog records meaningful project milestones. It is not a substitute for Git history.

## 2026-08-24 - Initial Vercel Production Deployment

Status: VERIFIED

- Merged the verified release through pull request #5 after Quality, Tests,
  Build, Dependency Security, and E2E passed and GitHub reported no conflicts.
- Repaired the existing Vercel project, deployed `main` commit `ab90ebc`, and
  assigned the stable HTTPS domain `my-kustomers-main-app.vercel.app`.
- Reduced Vercel to the four application-required Sensitive Production-only
  variables; excluded direct database credentials, email-provider values, E2E
  credentials, and runtime-test controls from the deployed environment.
- Configured the stable Supabase Auth Site URL and two exact application callback
  URLs without a Preview wildcard. No database migration was run by Vercel.
- Verified the live canonical customer/booking/public-capability workflow,
  trusted sharing and safe metadata, amendment, add-on, feedback, outbox,
  dashboard navigation, live search, Storage logo lifecycle, logout/protected
  access, responsive layouts, HTTPS, PWA assets, and clean runtime logs with
  self-cleaning controlled fixtures.
- Kept customer transactional email on the no-network development adapter and
  documented that the initial deployment still uses the development Supabase
  project. External customer email delivery is not configured.

## 2026-08-23 - Live Debounced Search Consistency

Status: VERIFIED

- Replaced explicit text-search submission on Bookings and Customers with one
  shared 300 ms debounced URL control. Typing and clearing use replace-style
  navigation, preserve compatible filters and limits, and reset pagination.
- Kept both list pages server-rendered and retained their existing tenant-scoped
  PostgREST projections, escaping, search fields, status/archive filters, and
  pagination semantics.
- Made New Booking's bounded active-customer picker expose automatically visible,
  keyboard-reachable matching candidates after the same debounce while preserving
  inline-customer mode, duplicate warnings, and unrelated booking form state.
- Added focused component tests for debounce/request count, clearing, URL
  composition, filter preservation, page reset, Back/Forward synchronization,
  and stale-timer cleanup, plus live Playwright search/filter/picker journeys and
  the 320-1440px overflow matrix.
- Added no dependency, database migration, schema change, or cross-tenant query
  relaxation. Server-paginated customer autocomplete remains deferred.

## 2026-08-23 - Booking Integrity Consolidation

Status: VERIFIED

- Audited the combined confirmation, reschedule, cancellation, amendment,
  add-on, sharing, outbox, analytics, authorization, RLS, and history model
  against the live development schema.
- Documented permanent booking invariants and the explicit customer agreement
  request matrix without changing product semantics.
- Consolidated repeated public capability rate limiting, first-open request
  handling/client tracking, metadata security defaults, and effective-total
  calculation while retaining purpose-specific domain wrappers and RPCs.
- Added a live integrity scenario covering original 45,000 confirmation,
  confirmed 55,000 amendment, confirmed 18,000 add-on, 73,000 effective value,
  booking count one, and cancellation with all evidence preserved.
- Added a forward migration that removes four exact duplicate B-tree indexes;
  no table, policy, function, grant, or product contract changed.

## 2026-08-23 - Booking Add-ons And Customer Confirmation

Status: VERIFIED

- Added tenant-owned `booking_addons` and purpose-specific confirmation links
  for new scope without mutating original booking or amendment evidence.
- Enforced parent/business/currency consistency, safe integer minor amounts,
  `CONFIRMED`/`IN_PROGRESS` eligibility, one awaiting request, immutable
  confirmed terms, inherited delivery schedule, and pending amendment/add-on
  exclusion at the database boundary.
- Added vendor draft/submit/reissue/cancel/share UI and `/x/[token]` customer
  review with safe metadata, first-open tracking, responsive layouts, and atomic
  one-time confirmation.
- Extended audit/history and the durable outbox with add-on request/confirmed
  events. Provider failure does not roll back pending or confirmed domain state.
- Derived effective booking totals and analytics from all confirmed add-ons only;
  pending/cancelled add-ons contribute zero and parent booking count stays one.
- Applied the main migration and two forward fixes for parent/currency trigger
  integrity and regenerated-request email idempotency. Static, live runtime, and
  canonical desktop/mobile E2E verification pass.
- Deferred confirmed add-on correction/cancellation, independent delivery,
  catalog/inventory, payment processing, billing, and broad redesign.

## 2026-08-23 - Booking Amendments And Customer Reconfirmation

Status: VERIFIED

- Added a tenant-owned `booking_amendments` aggregate with immutable structured
  old/proposed/effective terms, base/proposed hashes, changed fields, required
  reason, frozen confirmation contact, one-active policy, and full token state.
- Kept canonical booking terms unchanged while pending. A separate 24-hour
  hash-only capability and service-only atomic confirmation RPC apply allowed
  fields only after stale-base, lifecycle, revocation, expiry, and purpose checks.
- Added minimal vendor proposal/pending/revoke/share UI and `/a/[token]` customer
  Current/Proposed diff with safe business-only metadata and first-open tracking.
- Extended booking history, audit events, and the existing outbox with amendment
  request/confirmed email. Provider failure does not change proposal or approval
  truth; cancellation uses current amended terms while original evidence remains.
- Kept reschedule as the specialized date-only pre-work reconfirmation path;
  reschedule, cancellation, and advancement to `READY` revoke pending amendments.
- Applied the main migration and three forward live-found fixes for PL/pgSQL
  parameter resolution and inferable email idempotency. Static, live tenant/
  purpose/race/stale/revoke/cancellation/analytics tests and canonical desktop/
  mobile responsive E2E pass.
- Deferred add-ons, customer negotiation/rejection, billing, payment processing,
  broad UI redesign, and unrelated lifecycle email.

## 2026-08-23 - Confirmed Booking Integrity And Cancellation Notification

Status: VERIFIED

- Locked customer-agreed customer, title, description, currency, total,
  deposit, and schedule fields at the database boundary from confirmation
  onward while preserving draft edits, internal notes, and explicit reschedule
  reconfirmation.
- Revoked open confirmation links when material terms change while awaiting the
  customer, preserving the historical confirmation/link model.
- Required bounded plain-text reasons for customer-confirmed cancellation and
  preserved confirmation row, contact, snapshot/hash, confirmed timestamp,
  status history, and audit evidence after cancellation.
- Added atomic/idempotent `BOOKING_CANCELLED` outbox events, immutable
  confirmation-contact-first recipient selection, safe HTML/text templates,
  neutral payment/refund guidance, and post-commit provider failure semantics.
- Applied the forward migration and a forward RPC column-qualification fix to
  development. Live crafted-update, cross-tenant, capability, recipient,
  provider-failure, and concurrent cancellation scenarios pass.
- Kept amendments, add-ons, payment processing, billing, other lifecycle email,
  and broad UI redesign out of scope.

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
