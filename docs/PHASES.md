# Phases

## Status Labels

- PLANNED: Specified but not yet implemented.
- IMPLEMENTED: Repository evidence exists.
- VERIFIED: Repository evidence exists and appropriate verification has succeeded.

Documentation is not implementation evidence.

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
booking reference, and trigger-owned status history.

Explicit exclusions: Confirmation tokens, customer-facing booking links,
feedback, analytics expansion, billing, payment processing, and booking items.

Data-model impact: `bookings` and `booking_status_history` are represented in
the Phase 5 Supabase migration. Booking items remain planned.

Security impact: Tenant ownership, booking/customer business consistency,
immutable ownership fields, constrained lifecycle transitions, terminal booking
locks, RLS, grants, and trigger-owned status history.

UI impact: Booking list, search/filter/pagination controls, create form,
detail/edit form, status controls, money summary, dashboard booking counters,
and status history display.

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

Known risks: Confirmation links, customer-visible booking state, booking items,
and payment collection are deliberately deferred; future phases must not treat
booking references as security credentials.

## Phase 6 - Customer Confirmation

Status: PLANNED

Objective: Allow vendors to send customers secure confirmation links.

Dependencies: Phase 5.

Scope: Cryptographically strong tokens, hashed token storage where appropriate, expiration, consumption, revocation, customer confirmation, re-confirmation after material changes, secure public endpoints.

Explicit exclusions: Email provider automation beyond what is required for the phase, payment collection.

Data-model impact: Confirmation links and booking confirmation events.

Security impact: High. Public token endpoints, rate limiting, token storage, and scoped access.

UI impact: Customer-facing confirmation view.

Testing requirements: Valid, expired, revoked, consumed, and tampered-token tests.

Documentation requirements: Update security, testing, data model, changelog.

Acceptance criteria: Customer can confirm only the intended booking through a valid scoped link.

Known risks: Token leakage and replay.

## Phase 7 - Fulfilment and Booking Lifecycle

Status: PLANNED

Objective: Implement operational workflow.

Dependencies: Phase 5 and Phase 6 as needed.

Scope: Status definitions such as DRAFT, AWAITING_CUSTOMER, CONFIRMED, IN_PROGRESS, READY, DELIVERED, COMPLETED, CANCELLED.

Explicit exclusions: Analytics and feedback beyond lifecycle events.

Data-model impact: Status history and allowed transitions.

Security impact: Authorized state changes and auditability.

UI impact: Status controls and history display.

Testing requirements: Transition rules, invalid transitions, authorization.

Documentation requirements: Formal status definitions before implementation.

Acceptance criteria: Status changes are explicit, auditable, and valid.

Known risks: Inconsistent lifecycle semantics.

## Phase 8 - Private Feedback and Issues

Status: PLANNED

Objective: Allow customers to privately provide feedback about completed bookings and support operational issue records.

Dependencies: Phase 7.

Scope: Private feedback, issue records, secure customer access.

Explicit exclusions: Public review marketplace.

Data-model impact: Feedback and issues.

Security impact: Scoped customer links and tenant visibility.

UI impact: Customer feedback flow and vendor issue visibility.

Testing requirements: Feedback access, completion gating, tenant isolation.

Documentation requirements: Update product, data, security, testing.

Acceptance criteria: Feedback is private and attached to the intended booking/business.

Known risks: Privacy leakage.

## Phase 9 - Business Insights and Analytics

Status: PLANNED

Objective: Calculate business insights from actual transactional records.

Dependencies: Booking and customer data.

Scope: Bookings, completed booking value, average order value, repeat customer rate, delivery performance, feedback summaries.

Explicit exclusions: Fabricated analytics.

Data-model impact: Derived queries or analytics records only after design.

Security impact: Analytics must remain tenant scoped.

UI impact: Insights views.

Testing requirements: Calculations from seeded real records and cross-tenant tests.

Documentation requirements: Document metric definitions.

Acceptance criteria: Analytics are based on actual stored data.

Known risks: Misleading metrics.

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
