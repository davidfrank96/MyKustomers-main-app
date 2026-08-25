# Phases

## Status Labels

- PLANNED: Specified but not yet implemented.
- IMPLEMENTED: Repository evidence exists.
- VERIFIED: Repository evidence exists and appropriate verification has succeeded.

Documentation is not implementation evidence.

The 2026-08-21 responsive alignment and documentation governance pass is
cross-phase maintenance for the implemented product surface. It does not start
Phase 10 billing or mark Phase 11's broader PWA/UX hardening and visual redesign
as implemented.

The 2026-08-21 main-branch reconciliation and CI quality gate is cross-phase
repository maintenance, not a product phase. It preserves the current product
and Phase 9.5 UX evidence, adds no schema migration, does not start billing or
the broad redesign. Pull request #2 passed every core remote job and reported a
clean merge state, so this maintenance pass is VERIFIED; guarded Runtime
Security configuration remains separate follow-up governance work.

The 2026-08-21 mobile account, business identity, and dashboard navigation pass
is VERIFIED cross-phase maintenance. It preserves the five-item mobile product
navigation, exposes Settings/logout through the authenticated account menu,
adds owner-managed website and bounded logo identity, extends minimized public
confirmation branding, and maps existing dashboard tiles to real destinations.
The two forward migrations are applied to development; static, live storage/RLS,
responsive, confirmation, and focused E2E evidence passed. Billing and the broad
redesign remain unstarted.

The 2026-08-24 business-switcher discoverability and Google Auth pass is
IMPLEMENTED with full Google verification blocked by Supabase redirect
configuration. The Business page now exposes
active memberships, roles, current state, switching, and additional-business
creation while reusing the validated current-business action. Supabase Google
OAuth application support reuses the existing callback, profile trigger,
onboarding, tenant resolution, and logout. The configured development project
reports Google enabled; a real authorization reached Google and Supabase, and a
controlled downstream callback verified Google session establishment, profile
provisioning, zero-business onboarding, refresh persistence, and logout. Supabase
currently falls back to the production Site URL root instead of allowing the
exact local application callback, so the unassisted callback, same-email,
one/multi-business-after-Google, CI, and production journeys remain unverified.
This pass adds no schema migration, Vercel variable, provider, billing, or broad
redesign.

## Phase 0 - Product Definition

Status: VERIFIED

Objective: Establish the product concept, user problem, scope, initial architecture, and V1 boundaries.

Dependencies: None.

Scope: Product vision, product boundaries, accepted architecture direction.

Explicit exclusions: Product feature implementation.

Data-model impact: Conceptual only.

Security impact: Security principles identified.

UI impact: Directional only.

Testing requirements: Documentation review.

Documentation requirements: Product and boundary documentation.

Acceptance criteria: Product direction can be understood without conversation history.

Known risks: Scope creep if boundaries are ignored.

## Phase 1 - Repository Foundation

Status: VERIFIED

Objective: Create the technical foundation.

Dependencies: Phase 0.

Scope: Next.js app foundation, strict TypeScript, Tailwind, responsive shells, UI primitives, environment handling, Supabase boundaries, tests, PWA preparation, and foundation docs.

Explicit exclusions: Authentication, schema, onboarding, CRUD, email, billing, analytics, feedback, and integrations.

Data-model impact: No application tables.

Security impact: Security principles and server/client secret boundaries documented and scaffolded.

UI impact: Minimal public and dashboard shells.

Testing requirements: Lint, typecheck, Vitest, Playwright smoke, build.

Documentation requirements: README, architecture, development, security, product boundaries.

Acceptance criteria: App installs, runs, builds, and tests pass.

Known risks: Future phases must not mistake placeholders for product functionality.

## Phase 1.5 - Project Governance and Planning

Status: VERIFIED

Objective: Make repository documentation authoritative for future implementation.

Dependencies: Phase 1.

Scope: Master plan, product spec, phases, ADRs, conceptual data model, design system, testing strategy, changelog, release checklist, and governance rules.

Explicit exclusions: Product feature implementation, database schema, RLS policies, external integrations.

Data-model impact: Conceptual documentation only.

Security impact: Security invariants formalized; application-specific controls remain PLANNED unless already implemented.

UI impact: None.

Testing requirements: Existing repository verification suite.

Documentation requirements: Update only affected docs.

Acceptance criteria: A future coding agent can identify product direction, current phase, exclusions, accepted decisions, planned model, security invariants, and verification requirements from repository files.

Known risks: Documents must stay maintained as future implementation changes repository reality.

## Phase 2 - Authentication and Multi-Tenancy Foundation

Status: IMPLEMENTED - VERIFICATION PENDING

Objective: Implement Supabase Auth and tenant-aware platform access.

Dependencies: Phase 1.5.

Scope: Signup, login, logout, password recovery, authenticated application boundaries, businesses, business memberships, tenant-aware authorization, initial RLS, and initial audit/security foundation.

Explicit exclusions: Business onboarding depth, customer CRUD, booking engine, billing, analytics, feedback.

Data-model impact: Profiles, businesses, business memberships, and audit logs are represented in the Phase 2 Supabase migration.

Security impact: High. Must implement server authorization and RLS carefully.

UI impact: Auth routes and authenticated boundary states.

Testing requirements: Auth validation, route protection, static migration/RLS review, service-role boundary review, E2E smoke tests, and runtime Supabase RLS/security tests. Runtime Supabase database/RLS verification succeeded in Phase 2V. Public signup and reset-password completion remain partial because the configured development Supabase project hit email/default-inbox constraints during verification.

Documentation requirements: Update MASTER_PLAN, PHASES, DATA_MODEL, SECURITY, TESTING, CHANGELOG, and README if behavior changes.

Acceptance criteria: Authenticated platform user can access only authorized tenant scope. Runtime tenant isolation, RLS, grants, helper functions, profile isolation, owner/member authorization, audit boundaries, login, session persistence, logout, protected-route behavior, and redirect safety have verification evidence. Phase 2 overall remains VERIFICATION PENDING until public signup confirmation and reset-password flows can be completed end to end with a safe inbox.

Known risks: Incorrect tenant assumptions, weak RLS, or exposing service-role credentials.

## Phase 3 - Business Onboarding

Status: VERIFIED

Objective: Allow authenticated owners to establish and manage their business identity.

Dependencies: Phase 2.

Scope: Business name, slug, category, description, contact information, address text, basic business profile, onboarding state, atomic owner membership creation.

Explicit exclusions: Customer management, bookings, billing.

Data-model impact: Business profile fields added to `businesses`. Logo/storage references are deferred.

Security impact: Tenant ownership checks, RLS-preserving creation RPC, and owner-only profile updates.

UI impact: Onboarding flow and business settings foundation.

Testing requirements: Owner onboarding, unauthorized access, member update denial, duplicate slug, and atomic failure tests.

Documentation requirements: Update affected product, data, security, and phase docs.

Acceptance criteria: Owner can create or complete business profile within authorized tenant.

Verification evidence: Migration `20260818140502_phase_3_business_onboarding.sql`, runtime Supabase tests, validation tests, E2E onboarding tests, lint, typecheck, full tests, build, and dependency audit.

Known risks: Future logo/file ownership remains deferred to a storage-specific phase.

## Phase 4 - Customer Management

Status: VERIFIED

Objective: Implement customer records belonging to individual businesses.

Dependencies: Phase 2 and relevant business setup from Phase 3.

Scope: Create, edit, view, archive, search, and customer history foundation.

Explicit exclusions: Booking engine and public customer accounts.

Data-model impact: `customers` table with required `business_id`, customer
contact fields, notes, timestamps, and `archived_at`.

Security impact: Customer tenant RLS, immutable business ownership, anonymous
denial, and cross-tenant read/write protections.

UI impact: Customer list, search/filter/pagination controls, create form,
detail/edit form, archive action, dashboard customer count, and honest empty
states.

Testing requirements: CRUD, search, archive, anonymous denial, member
permissions, unauthorized create, business reassignment denial, and cross-tenant
tests.

Documentation requirements: Update data model, testing, security, changelog.

Acceptance criteria: Business user can manage only their business customers.

Verification evidence: Migration `20260818142125_phase_4_customer_management.sql`,
runtime Supabase tests, validation tests, migration/static RLS tests, E2E
customer management tests, lint, typecheck, full tests, build, and dependency
audit.

Known risks: Customer PII retention/deletion policy remains future
privacy/compliance work; bookings/customer history are still Phase 5+.

## Phase 5 - Booking Engine

Status: VERIFIED

Objective: Implement the primary domain object of the platform.

Dependencies: Phase 4.

Scope: Booking creation, tenant customer association, agreed value,
deposit/balance tracking, scheduled date, notes, lifecycle states, immutable
booking reference, trigger-owned status history, and verified inline customer
creation during New Booking.

Explicit exclusions: Confirmation tokens, customer-facing booking links,
feedback, analytics expansion, billing, payment processing, and booking items.

Data-model impact: `bookings` and `booking_status_history` are represented in
the Phase 5 Supabase migration. Booking items remain planned.

Security impact: Tenant ownership, booking/customer business consistency,
immutable ownership fields, constrained lifecycle transitions, terminal booking
locks, RLS, grants, and trigger-owned status history.

UI impact: Booking list, search/filter/pagination controls, create form,
detail/edit form, status controls, money summary, dashboard booking counters,
and status history display. New Booking explicitly supports searching/selecting
an active customer or entering a minimal new customer without leaving the flow.

Testing requirements: Booking creation, references, validation, authorization,
tenant isolation, cross-tenant denial, business/customer reassignment denial,
invalid finance denial, invalid transition denial, history fabrication denial,
anonymous denial, E2E booking journey, lint, typecheck, tests, build, audit, and
runtime Supabase security tests.

Documentation requirements: Formalize booking status and update data/security docs.

Acceptance criteria: Vendor can create and inspect tenant-owned booking records.

Verification evidence: Migration
`20260818222232_phase_5_booking_engine.sql`, booking domain tests, static
migration/RLS tests, runtime Supabase booking security tests, E2E booking
create/edit/transition/cancel coverage, lint, typecheck, full tests, production
build, and dependency audit.

Post-phase verification evidence: Migration
`20260820143032_inline_customer_booking_creation.sql`, discriminated validation
tests, static privileged-function tests, live atomicity/tenant/concurrency tests,
and desktop/mobile Playwright booking journeys. The current customer picker
still uses the existing bounded active-customer query; server-side paginated
picker search remains deferred.

Known risks: Confirmation links, customer-visible booking state, booking items,
and payment collection are deliberately deferred; future phases must not treat
booking references as security credentials.

## Phase 6 - Secure Customer Confirmation Links

Status: VERIFIED

Objective: Allow vendors to send customers secure confirmation links.

Dependencies: Phase 5.

Scope: Cryptographically strong opaque tokens, hash-only token storage, 24-hour
default expiration, one-time customer confirmation by POST, revocation,
regeneration, confirmation evidence, re-confirmation after material changes,
secure public endpoints, persistent rate limiting, and minimized public booking
views.

Explicit exclusions: Email provider automation beyond what is required for the phase, payment collection.

Data-model impact: `confirmation_links`, `booking_confirmations`,
`confirmation_rate_limits`, `AWAITING_CUSTOMER` booking status, and current
confirmation terms fields on `bookings`.

Security impact: High. Public token endpoints, hash-only token storage,
server-only public lookup/confirmation RPCs, persistent rate limiting,
one-open-link enforcement, scoped access, and material-change invalidation.

UI impact: Customer-facing confirmation view.

Post-phase trusted-sharing enhancement: The one-time generated URL now has a
primary contextual sharing dialog with editable message text, an immutable
confirmation URL, native share, WhatsApp, Telegram, Copy message, and Copy link.
Dynamic Open Graph/Twitter metadata uses only safe public business identity. A
service-only idempotent first-open RPC and tenant-validated share audits expose
truthful method-selected and first-viewed evidence without claiming message
delivery or read receipts.

Testing requirements: Valid, expired, revoked, consumed, regenerated, tampered,
cross-tenant, race, public minimization, material-change invalidation,
non-material edit, rate-limit, E2E confirmation, lint, typecheck, tests, build,
audit, and runtime Supabase security tests.

Documentation requirements: Update security, testing, data model, changelog.

Acceptance criteria: Customer can confirm only the intended booking through a
valid scoped link, without a My Customers account, and links cannot expose
tenant-private data or authorize unrelated bookings.

Verification evidence: Migration
`20260818230911_phase_6_secure_customer_confirmation_links.sql`,
confirmation-link unit tests, static migration/security tests, runtime Supabase
confirmation security tests, Playwright public confirmation journey coverage,
lint, typecheck, full tests, production build, and dependency audit.

Post-phase foundation enhancement: Migration
`20260820131919_customer_contact_confirmation_email_foundation.sql` requires a
normalized customer-provided email at confirmation, optionally records phone,
preserves both on immutable confirmation evidence, enriches only empty customer
fields, and atomically creates one durable `BOOKING_CONFIRMED` email event.
Provider delivery happens after commit through a server-only abstraction, so
delivery failure cannot undo confirmation. This enhancement is VERIFIED against
the configured development Supabase database.

Trusted-sharing verification evidence: Migration
`20260823105232_trusted_confirmation_sharing.sql`, share/metadata unit tests,
dialog integration tests, static grant/security tests, live Phase 6 runtime
coverage, and Playwright share/metadata/customer-view assertions.

Known risks: Future email automation must preserve raw-token non-logging,
short-lived links, no account requirement, and material-change invalidation.

## Phase 7 - Fulfilment and Booking Lifecycle

Status: VERIFIED

Objective: Implement operational workflow.

Dependencies: Phase 5 and Phase 6.

Scope: Controlled vendor lifecycle transitions, rescheduling before fulfilment,
operational timestamps, cancellation reasons, immutable status/change history,
and dashboard/list operational queues for due today, overdue, in-progress, and
ready bookings.

Explicit exclusions: Analytics and feedback beyond lifecycle events.

Data-model impact: Phase 7 migration
`20260818234428_phase_7_fulfilment_operational_lifecycle.sql` adds
`started_at`, `ready_at`, `delivered_at`, `cancellation_reason`,
`booking_changes`, operational constraints, lifecycle RPCs, and updated booking
integrity triggers.

Security impact: Direct authenticated status writes are blocked; vendor state
changes route through authenticated RPCs with tenant membership checks, row
locking, RLS-compatible grants, trigger-owned status history, and audit events.
Anonymous users and customer confirmation tokens cannot perform vendor
operational transitions.

UI impact: Booking detail includes status controls, cancellation reason input,
rescheduling controls, operational timestamp summary, and combined status/change
timeline. Dashboard and booking list include operational queues and filters.

Testing requirements: Domain transition tests, static migration/security tests,
runtime Supabase operational lifecycle tests, Playwright booking lifecycle E2E,
lint, typecheck, full tests, build, audit, and tenant/RLS regression suite.

Documentation requirements: Update master plan, phase roadmap, data model,
security invariants, ADRs, testing strategy, changelog, and feature docs.

Acceptance criteria: Status changes are explicit, auditable, valid, tenant-safe,
and cannot be driven by anonymous users, cross-tenant users, or public customer
tokens.

Verification evidence: Migration
`20260818234428_phase_7_fulfilment_operational_lifecycle.sql`, booking domain
tests, static Phase 7 migration tests, runtime Supabase operational lifecycle
tests, Playwright create-confirm-reschedule-reconfirm-complete journey coverage
on desktop and mobile, lint, typecheck, full tests, production build, and
dependency audit.

Known risks: Future fulfilment details, staff permissions, notifications,
feedback, and analytics must preserve the controlled lifecycle boundary rather
than adding direct client-side status mutation paths.

## Phase 8 - Private Feedback and Issues

Status: VERIFIED

Objective: Allow customers to privately provide feedback about completed bookings and support operational issue records.

Dependencies: Phase 7.

Scope: Secure completed-booking feedback links, private feedback submission,
vendor-visible feedback, internal operational issue records, issue resolution,
public endpoint hardening, and tenant isolation.

Explicit exclusions: Public review marketplace, analytics summaries,
notification/email automation, staff assignment, and customer accounts.

Data-model impact: Phase 8 migration
`20260819001954_phase_8_private_feedback_issues.sql` adds `feedback_links`,
`feedback`, `booking_issues`, issue enums, feedback RPCs, integrity triggers,
RLS policies, grants, and audit event types.

Security impact: Dedicated feedback token purpose, hash-only token storage,
completed-booking eligibility, public endpoint rate limiting, no-store/noindex
headers, immutable feedback, tenant-only vendor visibility, issue RLS, and
least-privilege service-role RPC boundaries.

UI impact: Customer-facing `/f/[token]` feedback form, vendor feedback link
panel, private feedback display on booking and customer detail pages, and
operational issue create/resolve UI on booking detail pages.

Testing requirements: Feedback token lifecycle, wrong-purpose token attacks,
completion gating, public minimization, immutable feedback, tenant isolation,
vendor mutation denial, issue authorization, issue lifecycle, race behavior,
audit events, public headers, responsive E2E, lint, typecheck, tests, build,
audit, and runtime Supabase security tests.

Documentation requirements: Update master plan, phase roadmap, data model,
security invariants, ADRs, testing strategy, changelog, release checklist, and
feature docs.

Acceptance criteria: Feedback is private and attached only to the intended
completed booking/business; operational issues are internal tenant records and
cannot be accessed or mutated cross-tenant or publicly.

Verification evidence: Migration
`20260819001954_phase_8_private_feedback_issues.sql`, feedback domain tests,
static Phase 8 migration/security tests, runtime Supabase feedback/issue
security tests, Playwright feedback and issue lifecycle coverage, lint,
typecheck, full tests, production build, and dependency audit.

Known risks: Future analytics, notifications, public reviews, and staff
assignment must not broaden public token privileges or expose private feedback
comments outside the owning business.

Cross-phase maintenance evidence (2026-08-24): Private feedback request sharing
now reuses the existing trusted-sharing stack, adds service-only idempotent
first-open evidence, and keeps preview crawlers outside the private booking
lookup. Major authenticated routes provide accessible structural loading states;
business switching hides stale workspace content while pending. Authentication
and current-business reads are request-memoized only. No persistent tenant cache,
public review, notification delivery, or Phase 10 work was introduced. Full
local quality, live security, desktop/mobile browser, build, audit, database
lint, and whitespace gates pass; evidence is tracked in `docs/TESTING.md` and
`docs/PERFORMANCE.md`.

## Phase 9 - Business Insights and Analytics

Status: VERIFIED

Objective: Calculate business insights from actual transactional records.

Dependencies: Booking and customer data.

Scope: Authenticated private insights page, date ranges, documented metric
definitions, tenant-scoped aggregate RPC, customer activity, booking counts,
currency-specific recorded/completed value, operational metrics, feedback
metrics, issue summaries, simple previous-period comparison, and dashboard
summary.

Explicit exclusions: Fabricated analytics, public reports, exports, billing,
payment/accounting claims, profit/tax/expense calculations, AI recommendations,
forecasting, analytics-specific roles, materialized views, and email reports.

Data-model impact: Phase 9 migration
`20260819010145_phase_9_business_insights_analytics.sql` adds targeted indexes
and `public.get_business_insights`; follow-up migration
`20260819011341_phase_9_fix_insights_current_time.sql` corrects the applied RPC
variable name. Follow-up migration
`20260820030000_phase_9_fix_booking_trend_buckets.sql` aligns completed trend
buckets with the documented `completed_at` period rule. No analytics tables or
views were added.

Security impact: Aggregates are tenant-private data. The application resolves
current business server-side, the RPC checks active membership, and cross-tenant
aggregate access is denied.

UI impact: `/insights` replaces the placeholder with a responsive private
business insights page and the dashboard receives a compact monthly summary.

Testing requirements: Date-range parsing, previous-period comparison, zero
denominator handling, documented definitions, exact runtime metric fixtures,
currency separation, cross-tenant aggregate denial, reschedule/current-schedule
on-time behavior, E2E insights journey, responsive coverage, full regression
suite, build, audit, and Phase 2-8 runtime security regression.

Documentation requirements: Update master plan, phase roadmap, product spec,
data model, security invariants, ADRs, testing strategy, changelog, release
checklist, analytics README, and `docs/ANALYTICS_DEFINITIONS.md`.

Acceptance criteria: Analytics are based on actual stored data, definitions are
explicit, financial terminology is conservative, currencies are never mixed,
and aggregates cannot leak cross-tenant information.

Verification evidence: Migrations
`20260819010145_phase_9_business_insights_analytics.sql` and
`20260819011341_phase_9_fix_insights_current_time.sql`, analytics unit tests,
static migration tests, live Supabase runtime analytics test, Playwright
insights E2E coverage, lint, typecheck, full tests, runtime security tests,
production build, and dependency audit.

Known risks: Future reporting, export, scheduled email, analytics caching, staff
visibility controls, and billing must preserve tenant-private aggregate
boundaries and documented metric definitions.

## Phase 9.5 - Product UX, Design, and End-to-End Experience Audit

Status: VERIFIED

Objective: Audit and tighten the implemented product experience before
subscription billing work begins.

Dependencies: Phases 0 through 9.

Scope: Mobile-first UX audit, responsive review at 375px, 390px, 430px, 768px,
and desktop widths, navigation hierarchy, end-to-end workflow coherence,
empty-state usefulness, product terminology, money display, booking detail
state hierarchy, public confirmation and feedback pages, insights
interpretability, and canonical E2E journey coverage.

Explicit exclusions: Subscription billing, customer-to-vendor payments,
payment verification, messaging automation, exports, staff management, native
mobile, public review publishing, schema changes, and security-model weakening.

Data-model impact: None.

Security impact: No security controls were weakened. Phase 9.5 preserved
server-side authorization, RLS boundaries, public token minimization, and
tenant-private analytics behavior.

UI impact: Active authenticated navigation, clearer booking next-step
hierarchy, safer owner/customer copy, natural NGN currency display, improved
feedback-link recovery messaging, and tightened onboarding/dashboard/search
language.

Testing requirements: Product UX audit, responsive visual audit, canonical
Playwright journey, lint, typecheck, unit/integration tests, runtime security
regression, E2E suite, production build, and dependency audit.

Documentation requirements: Add `docs/UX_AUDIT.md` and update master plan,
phase roadmap, product spec, design system, testing strategy, changelog,
release checklist, development guide, and materially affected feature docs.

Acceptance criteria: A small-business owner can understand the core workflow
from login through insights without seeing internal terminology, mobile layouts
remain usable at the target widths, public customer pages remain simple and
safe, money display matches expected owner input, and the canonical product
journey has automated E2E coverage.

Verification evidence: `docs/UX_AUDIT.md`, active navigation component, booking
next-step panel, copy and money-formatting updates, strengthened booking E2E
journey, unit formatter updates, responsive Playwright visual audit, lint,
typecheck, full tests, runtime security regression, E2E, production build, and
dependency audit.

Known risks: Future billing, messaging, exports, staff roles, native/PWA
enhancements, and public review features must preserve the same mobile-first
UX baseline and security boundaries.

## Phase A - Confirmed Booking Integrity and Cancellation Notification

Status: VERIFIED

Objective: Preserve customer-agreed booking terms as immutable historical
evidence and notify the authoritative booking contact when a confirmed booking
is cancelled.

Scope: Database-enforced material-term lock from `CONFIRMED` onward,
awaiting-customer link invalidation on material edits, preserved explicit
rescheduling/reconfirmation, editable internal notes before terminal states,
required plain-text confirmed-cancellation reasons, atomic/idempotent
`BOOKING_CANCELLED` outbox creation, confirmation-contact-first recipient
selection, provider-neutral HTML/text delivery, and race/security regression
coverage.

Explicit exclusions: Booking amendments, add-ons, payment/refund processing,
billing, other lifecycle emails, and broad UI redesign.

Data-model impact: `email_event_type` includes `BOOKING_CANCELLED`; outbox
idempotency is per confirmation and event type. Booking confirmation evidence is
never deleted or rewritten by cancellation.

Security impact: Direct crafted material writes fail in PostgreSQL; lifecycle
RPC membership checks, customer capability isolation, service-only outbox
claims, RLS, and terminal locks remain enforced.

UI impact: Confirmed material controls are disabled with a clear lock message;
internal notes, explicit rescheduling, and current lifecycle actions remain.

Testing requirements: Material mutation matrix, internal-note and reschedule
regressions, awaiting-link invalidation, cross-tenant/anonymous cancellation
denial, concurrent cancellation uniqueness, recipient conflict, provider
failure persistence, confirmation/sharing regression, and desktop/mobile E2E.

Acceptance criteria: One customer-confirmed agreement remains historically
truthful after cancellation, one cancellation event targets the authoritative
contact, and no ordinary path can rewrite agreed terms.

Phase A boundary at completion: Amendments required a future reconfirmation
workflow. Phase B supplies that workflow. Phase C supplies linked add-ons
without rewriting the original agreement; add-ons with independent fulfilment
become separate bookings.

## Phase B - Booking Amendments and Customer Reconfirmation

Status: VERIFIED

Objective: Allow explicit customer-approved material changes without mutating a
confirmed agreement before approval.

Scope: Dedicated structured amendment evidence; `CONFIRMED` and `IN_PROGRESS`
eligibility; one active pending request; required bounded plain-text reason;
hash-only purpose-specific 24-hour token; safe public current/proposed diff;
vendor share/revoke; stale-base validation; atomic customer confirmation;
booking-change/audit history; request/confirmation outbox events; cancellation,
lifecycle, reschedule, analytics, and direct-edit regressions.

Explicit exclusions: Customer reassignment, explicit customer rejection/chat,
amendments at `READY` or later, add-ons, payment processing, billing, broad UI
redesign, and unrelated lifecycle email.

Data-model impact: Adds `booking_amendments`, extends `booking_changes` for
confirmed amendment history, and extends `email_events` with amendment subjects
and event types. Original `booking_confirmations` remain immutable.

Security impact: Public table access is denied; vendor reads are tenant-scoped;
vendor create/revoke RPCs derive membership; public lookup/open/confirm RPCs are
service-only; token purposes are separate; stale hashes and row locks prevent
lost updates and duplicate application.

UI impact: Booking detail adds a minimal proposed-change editor and pending
summary. `/a/[token]` has no dashboard shell and labels every changed value
Current and Proposed without exposing internal notes.

Testing requirements: Static migration/unit tests, live tenant/purpose/race/
stale/revoke/cancellation/email/analytics/direct-edit coverage, canonical desktop
and mobile E2E, and 320/360/375/390/430/768/1024/1440 responsive checks.

Acceptance criteria: Pending proposals never alter the booking; exactly one
customer confirmation applies effective terms once; original and amended
agreements remain reconstructable; security and analytics regressions stay green.

Deferred boundary at completion: Phase C now implements newly added linked scope
without rewriting the original agreement.

## Phase C - Booking Add-ons and Customer Confirmation

Status: VERIFIED

Objective: Add genuinely new scope to an existing agreement without rewriting
the original booking or any confirmed amendment evidence.

Scope: Dedicated structured add-on records; `DRAFT`, `AWAITING_CUSTOMER`,
`CONFIRMED`, and `CANCELLED` states; parent `CONFIRMED`/`IN_PROGRESS`
eligibility; inherited currency and current delivery schedule; integer minor
units; one awaiting request; separate hash-only 24-hour capability; safe public
review and trusted sharing; atomic customer confirmation; first-open, audit,
history, and request/confirmation outbox effects; derived effective totals and
analytics integration.

Explicit exclusions: Separate add-on delivery schedules or fulfilment states,
catalog/inventory, customer rejection/chat, confirmed add-on correction or
cancellation, payment processing, billing, broad UI redesign, and unrelated
lifecycle email.

Data-model impact: Adds `booking_addons` and
`booking_addon_confirmation_links`; extends audit and email event types and
subjects; analytics derives value from confirmed add-ons without changing
booking count.

Security impact: Parent/business/currency consistency is database-enforced;
confirmed terms are immutable; vendor writes use membership-checked RPCs;
public lookup/open/confirm is service-only; token purpose is distinct from
booking, amendment, and feedback capabilities; RLS and direct-write denial
remain active.

UI impact: Booking detail adds a compact add-on editor, state/effective-value
summary, and existing trusted-share interaction. `/x/[token]` is a focused
customer review route with inherited schedule and no dashboard shell.

Testing requirements: Static and unit coverage; live tenant, amount, purpose,
race, mutation, parent-state, lifecycle, cancellation, email-failure, evidence,
and multi-add-on analytics coverage; canonical desktop/mobile E2E; no-overflow
checks at 320/360/375/390/430/768/1024/1440.

Acceptance criteria: Pending add-ons never change current agreement totals;
one customer confirmation makes structured add-on evidence immutable exactly
once; effective totals include all and only confirmed add-ons; original and
amendment evidence remain unchanged; tenant and purpose attacks fail.

Deferred boundary: A separately scheduled or fulfilled item is a new booking.
Changing or cancelling confirmed add-on scope requires a future explicit
evidence-preserving workflow.

## Phase 10 - Subscription Billing

Status: PLANNED

Objective: Implement My Customers subscription billing.

Dependencies: Auth, business tenancy, subscription design.

Scope: Vendor subscription payments behind a provider abstraction.

Explicit exclusions: Customer-to-vendor transaction payments.

Data-model impact: Subscriptions and subscription events.

Security impact: Webhook validation, least privilege, billing event integrity.

UI impact: Subscription settings and billing status.

Testing requirements: Provider abstraction, webhook verification, access gating.

Documentation requirements: Update decisions if provider is selected.

Acceptance criteria: Business subscription status can be managed without coupling product code to one provider.

Known risks: Provider lock-in and webhook spoofing.

## Phase 11 - PWA and UX Hardening

Status: PLANNED

Objective: Polish responsive behavior and installation experience.

Dependencies: Core workflows.

Scope: PWA install quality, responsive behavior, mobile ergonomics.

Explicit exclusions: Complex offline caching unless explicitly designed.

Data-model impact: None expected.

Security impact: Avoid unsafe caching of sensitive data.

UI impact: Broad UX polish.

Testing requirements: Mobile and desktop E2E, accessibility checks.

Documentation requirements: Update design and release docs.

Acceptance criteria: App is reliable and polished on target mobile devices.

Known risks: Caching sensitive tenant data.

## Phase 12 - Security Hardening

Status: PLANNED

Objective: Perform dedicated security review.

Dependencies: Implemented core workflows.

Scope: Authorization, RLS, cross-tenant isolation, rate limiting, public tokens, file access, session governance, logging, abuse cases, secrets, CSP/security headers, dependency review.

Explicit exclusions: Treating this as the first time security is addressed.

Data-model impact: Possible audit/security migrations after review.

Security impact: High.

UI impact: Error states and secure UX refinements as needed.

Testing requirements: Security regression suite.

Documentation requirements: Update security findings and mitigations.

Acceptance criteria: Critical security invariants are verified.

Known risks: Discovering architectural changes late.

## Phase 13 - Production Readiness

Status: PLANNED

Objective: Complete production configuration and operational readiness.

Dependencies: Security hardening and launch scope.

Scope: Observability, error handling, backups, operational procedures, performance validation, accessibility review, privacy review, deployment checks.

Explicit exclusions: New product feature scope.

Data-model impact: Backup and operational considerations.

Security impact: Production controls verified.

UI impact: Production polish and error handling.

Testing requirements: Full release checklist.

Documentation requirements: Operational docs and release checklist updates.

Acceptance criteria: Production deployment risk is understood and controlled.

Known risks: Missing operational ownership.

## Phase 14 - Launch

Status: PLANNED

Objective: Controlled production release.

Dependencies: Phase 13.

Scope: Launch execution and monitoring.

Explicit exclusions: Unplanned feature expansion.

Data-model impact: Production data handling begins.

Security impact: Live-user security posture required.

UI impact: Launch-ready experience.

Testing requirements: Final smoke and monitoring checks.

Documentation requirements: Launch notes and changelog.

Acceptance criteria: Controlled release completes with monitoring.

Known risks: Support and incident response readiness.

## Cross-Phase Maintenance - Multi-Business Account Support

Status: VERIFIED

Implemented after Phase 9.5 without starting billing or later roadmap phases.
Accounts can create, restore, and switch among active business memberships from
the authenticated shell. Membership-specific roles remain authoritative, stale
preferences fall back safely, and all private operational surfaces follow the
resolved current business. Migration
`20260824094523_select_current_business_for_booking_creation.sql` removes the
last first-membership inference from atomic booking creation. Unit, static,
live Supabase, desktop/mobile E2E, and responsive evidence is recorded in
`docs/TESTING.md`.

## Admin Phase 0/1 - Platform Admin Authorization Foundation

STATUS: VERIFIED IN PRODUCTION

Implemented scope:

- dedicated `SUPER_ADMIN` role and `ACTIVE`/`DISABLED` authority model;
- RLS-enabled `platform_admins` table with no browser table grants or policies;
- authenticated self-scoped active-admin RPC;
- separate server-only platform authorization helpers and `/admin` layout;
- minimal accessible shell with only implemented navigation;
- trigger-backed authority-change audit and controlled bootstrap runbook;
- unit, static migration, live security, E2E, and responsive coverage.

Production evidence: the approved existing Auth account is the sole active
`SUPER_ADMIN`; the production route and shell passed; ordinary tenant roles
remain unrelated; an ACTIVE-to-DISABLED-to-ACTIVE round trip revoked and restored
the existing session on reload and produced the expected audit events.

Excluded: operational record browsing, impersonation, admin management UI,
billing, staff management, generic editing, destructive mutation, and hard
deletion.

## Admin Phase 2 - Read-Only Operations Overview

STATUS: VERIFIED IN PRODUCTION

Implemented scope:

- aggregate-only counts for businesses, profiles, customers, and bookings;
- active, due-today UTC, overdue, and completed booking counts;
- open issue and pending/sending/sent/failed email-event counts;
- narrow active-admin-only `SECURITY DEFINER` RPC and server-only query boundary;
- truthful loading, unavailable, and system-read states;
- exact live aggregate, denial, disablement, current-business independence,
  E2E, and 390/768/1024/1440 responsive regression coverage.
- clean PR #13 CI, merge commit `22e6617`, current/ready Vercel production
  deployment, authenticated overview smoke, and clean deployment runtime logs.

Excluded: PII, financial totals, record lists, search, exports, mutations,
impersonation, admin membership management, billing, and destructive controls.

## Admin Phase 3 - Read-Only Businesses And Users Directory

STATUS: VERIFIED IN PRODUCTION

Implemented scope:

- `/admin/businesses` and `/admin/users` server-rendered directories with
  debounced URL search, 20-row server pagination, and stable newest-first order;
- business detail with safe identity, all active memberships, and aggregate
  customer, booking, issue, and email-state counts;
- user detail with a narrow Auth projection, provider names only, all business
  memberships, and a specific platform-admin badge when present;
- business-to-user and user-to-business support navigation;
- four postgres-owned, active-admin-only `SECURITY DEFINER` RPCs, with no direct
  Auth-table grant and no service-role code path;
- unit, static security, opt-in runtime, E2E, and responsive regression coverage.

Verification used production-safe read-only reconciliation plus one temporary
zero-business admin account that was fully removed after the browser journey.
Ordinary and anonymous direct-RPC denial were reverified. Disabled-admin and
business-owner authority denial rely on the unchanged platform-admin boundary
and its prior verified runtime/revocation coverage; production authority was not
mutated to repeat disablement. The destructive isolated-fixture suite remains
environment-gated and was not used against production.

PR #15 passed all executable CI checks and merged as `4437a161`. Vercel deployed
that exact `main` commit, after which a fresh controlled zero-business admin
passed production overview, directory search/pagination, details, bidirectional
cross-links, refresh, logout, authorization redirect, and 390/768/1024/1440
responsive checks. Independent cleanup confirmed zero temporary Auth users and
profiles and restored the single approved active production `SUPER_ADMIN`.

Excluded: customer/booking row browsing, recent activity, exports, editing,
impersonation, suspension, password controls, membership mutation, hard deletion,
billing, and all Admin Phase 4 work.

## Admin Phase 4 - Read-Only Bookings And Issues Operations

STATUS: VERIFIED - PRODUCTION

Implemented scope:

- `/admin/bookings` and `/admin/issues` server-rendered, debounced-search,
  filtered, 20-row paginated directories with stable newest-first ordering;
- booking detail with minimized customer identity, effective values,
  confirmation evidence, amendments, add-ons, material/status history,
  cancellation evidence, structured feedback, issues, and grouped email state;
- issue detail with private description available only after active-admin
  authorization and linked business, booking, creator, and resolver context;
- four postgres-owned, empty-search-path, active-admin-only read RPCs and strict
  fail-closed DTOs, with no service-role browser path or current-business scope;
- unit, static security, E2E route/denial, loading, not-found, and responsive
  regression coverage.

Migration `20260825022135_platform_admin_read_only_booking_issue_operations.sql`
was explicitly approved and applied transactionally to the production-backed
project. Ownership/grants, active-admin and anonymous paths, exact count/value
reconciliation, real-data local browser flows, safe search/UUID behavior, and
390/768/1024/1440 responsive checks pass. PR #17 passed all eight checks and
merged as `edbef26`; Vercel deployed that exact `main` commit, and authenticated
production directory/detail smoke passed for all four routes with no browser
warning or error diagnostics.
Customer directory browsing, private feedback comments, full email operations,
editing, cancellation, status transitions, issue resolution, impersonation,
suspension, hard deletion, membership mutation, and billing are excluded.

## Admin Phase 5 - Read-Only Email Operations

Status: VERIFIED - PRODUCTION

Objective: Provide truthful platform-wide outbox visibility without exposing
customer communications or enabling external side effects.

Scope: `/admin/emails`, four authoritative status counts, Today/7-day/30-day
presets, actual event-type and status filters, bounded literal search, stable
20-row pagination, safe business/booking context, detail-only recipient masking,
controlled failure categories, adapter configuration state, and a documented
15-minute potential-stuck signal. One RPC combines summary and directory work;
one RPC returns detail, and strict DTO parsing protects both boundaries.

Security impact: Every RPC independently requires an active `SUPER_ADMIN`, is
postgres-owned with an empty search path, and grants execute only to
`authenticated`. No direct outbox table grant, service-role page query, body,
provider ID, raw failure, full recipient, token, mutation, or audit-on-read is
introduced. The current-business cookie is irrelevant.

Verification status: the approved production-backed migration applied
transactionally. Ownership, search paths, grants, anonymous/ordinary/disabled
denial, active-admin reads, filters, data minimization, outbox immutability, and
temporary-account cleanup pass. The full Playwright suite passes with 35 tests
and 7 intentional skips. PR #19 passed its required checks and merged as
`52a1820`; all `main` push checks passed apart from the intentional safe-target
Runtime Security skip, and Vercel deployed that exact commit. Authenticated
production smoke over nine existing events passed summary/list/detail, search,
filters, pagination, recipient masking, cross-links, absence of write controls,
and desktop overflow checks. Failed temporary Auth creation left zero matching
users; exactly one approved active `SUPER_ADMIN` remains. Docker is not used.
Admin Phase 6 remains planned and is not started.

## 2026-08-25 Booking Journey UX Maintenance

Status: VERIFIED - PRODUCTION

This targeted cross-phase UX pass adds a server-derived booking lifecycle
stepper, explicit current-state guidance, one prominent valid next action,
secondary cancellation/related workflows, reschedule reconfirmation context,
and derived feedback completion. It changes no persisted state, transition,
RPC, RLS policy, migration, or public customer route. It also clarifies
Scheduled delivery date and starts new total/deposit entry empty while keeping
the total required and normalizing an empty optional deposit to zero minor
units. Admin Phase 6 and broad visual redesign are not started.

PR #21 passed all required executable CI checks and merged conflict-free as
`b26f0c4`. Vercel deployed the same `main` commit. Controlled production smoke
verified form clarity, the confirmed-through-completed vendor journey, feedback
guidance, and 320-1440 responsive containment, then removed its temporary Auth,
business, customer, booking, history, confirmation, email, and audit fixtures
with zero account/business leftovers. Runtime fixture suites remained
intentionally skipped by the protected-backend safe-target gate; no gate was
weakened or bypassed.
