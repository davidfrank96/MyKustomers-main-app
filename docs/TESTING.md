# Testing

## Status

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

Phase 1 implemented test infrastructure and smoke tests. Most domain, security, and journey tests remain PLANNED until corresponding features exist.

## Test Categories

- Unit: Small deterministic utilities and isolated domain logic.
- Integration: Component and feature boundary behavior.
- End-to-End: Critical browser journeys.
- Security/authorization: Negative and cross-tenant access tests.
- Regression: Tests added for fixed bugs or high-risk behavior.

## Current Implemented Tests

- Unit smoke test for `cn`.
- Integration smoke test for `Button`.
- Playwright smoke tests for the homepage and dashboard shell.
- Phase 2 auth validation tests.
- Safe redirect tests.
- Static service-role boundary test for client components.
- Static Phase 2 migration/RLS review tests.
- Phase 2 runtime Supabase RLS/security test.
- Phase 3 business validation tests.
- Phase 3 runtime Supabase business onboarding/RLS/security test.
- Phase 4 customer validation tests.
- Static Phase 4 customer migration/RLS review tests.
- Phase 4 runtime Supabase customer tenant security test.
- Phase 5 booking domain tests.
- Static Phase 5 booking migration/RLS review tests.
- Phase 5 runtime Supabase booking tenant security test.
- Phase 6 confirmation-link domain tests.
- Static Phase 6 confirmation migration/security review tests.
- Phase 6 runtime Supabase confirmation-link security test.
- Phase 7 booking lifecycle domain tests.
- Static Phase 7 operational lifecycle migration/security review tests.
- Phase 7 runtime Supabase operational lifecycle security test.
- Phase 8 feedback domain tests.
- Static Phase 8 feedback/issue migration/security review tests.
- Phase 8 runtime Supabase feedback and issue security test.
- Playwright tests for unauthenticated protected-route redirect, auth screen rendering,
  login, session persistence, logout, forgot-password safe response, redirect safety,
  business onboarding, customer create/edit/archive, and booking
  create/edit/customer-confirmation/reschedule/reconfirmation/complete,
  private feedback submission, and operational issue create/resolve.

## Planned Critical Journeys

- E2E-001 - User can register. IMPLEMENTED AS ENV-GATED E2E TEST; PARTIAL in Phase 2V/2E because the configured Supabase project hit email constraints and no safe default-email inbox was configured.
- E2E-002 - User can login. VERIFIED.
- E2E-003 - User can logout. VERIFIED.
- E2E-010 - Business owner can create customer. VERIFIED.
- E2E-011 - Business owner can update customer. VERIFIED.
- E2E-020 - Vendor can create booking. VERIFIED.
- E2E-021 - Booking receives human-readable reference. VERIFIED.
- E2E-030 - Valid customer confirmation token works. VERIFIED.
- E2E-031 - Expired confirmation token fails. VERIFIED by runtime security test.
- E2E-032 - Revoked confirmation token fails. VERIFIED by runtime security test.
- E2E-033 - Consumed token cannot be reused where one-time use is required. VERIFIED.
- E2E-034 - Confirmed booking can be rescheduled and requires reconfirmation. VERIFIED.
- E2E-035 - Confirmed booking can move through fulfilment to completion. VERIFIED.
- E2E-040 - Completed booking can request private feedback. VERIFIED.
- E2E-041 - Customer can submit private feedback through a scoped link. VERIFIED.
- E2E-042 - Vendor can create and resolve an internal booking issue. VERIFIED.

## Planned Security Tests

- SEC-TEST-001 - Business A cannot retrieve Business B customer. VERIFIED.
- SEC-TEST-002 - Business A cannot retrieve Business B booking. VERIFIED.
- SEC-TEST-003 - Business A cannot mutate Business B resource. VERIFIED.
- SEC-TEST-004 - Unauthenticated requests cannot access protected vendor resources. VERIFIED.
- SEC-TEST-005 - Unauthenticated users cannot access protected tenant data. VERIFIED.
- SEC-TEST-006 - Anonymous users and customer tokens cannot perform vendor
  booking lifecycle operations. VERIFIED.
- SEC-TEST-007 - Operational status history and booking changes cannot be
  fabricated by ordinary authenticated clients. VERIFIED.
- SEC-TEST-008 - Feedback tokens cannot be used across purposes, tenants,
  non-completed bookings, expired/revoked/consumed states, or direct table
  access. VERIFIED.
- SEC-TEST-009 - Booking issues cannot be accessed or mutated anonymously,
  publicly, or cross-tenant, and resolved issues are terminal. VERIFIED.

Do not create fake implementations merely so planned tests can pass.

Runtime database/RLS isolation verification succeeded during Phase 2V against the
configured development Supabase project. Phase 3 onboarding runtime verification
also succeeded against the configured development Supabase project. The opt-in
runtime tests live under `tests/security/*runtime*.test.ts` and can be run
against a local, development, staging, or test Supabase target with:

```bash
PHASE2_RUNTIME_VERIFICATION=1 PHASE2_SUPABASE_TARGET=local npm run test:security:runtime
```

The test requires `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. It is
skipped by default to avoid mutating an unidentified database.

The Phase 3 runtime test verifies authenticated RPC creation, unauthenticated
RPC denial, atomic rollback on invalid input, duplicate slug collision handling,
owner membership creation, owner update, member update denial, and cross-tenant
update denial.

The Phase 4 runtime test verifies customer tenant read matrix, cross-tenant
update/archive denial, unauthorized create denial, immutable `business_id`,
anonymous denial, owner/member write permissions, archived-record protection,
and search isolation.

The Phase 5 runtime test verifies booking tenant read matrix, unauthorized
create denial, booking/customer business consistency, immutable booking
`business_id`, `customer_id`, `reference`, and `created_by`, invalid finance
denial, member write permissions, valid and invalid lifecycle transitions,
direct vendor `DRAFT -> CONFIRMED` denial, terminal booking locks,
trigger-owned status history, anonymous denial, and search isolation.

The Phase 6 runtime test verifies confirmation token lifecycle, hash-only token
storage, public data minimization, GET lookup not consuming links, invalid token
handling, expired and revoked links, cross-tenant revoke denial, one-time
confirmation, confirmation evidence, snapshot/hash storage, material-change
invalidation, used-link snapshot stability, non-material internal-note edits,
cancellation invalidation, regeneration revocation, concurrent confirmation
behavior, persistent rate limiting, audit events, and raw-token non-logging.

The Phase 7 runtime test verifies controlled operational lifecycle transitions,
operational timestamps, invalid transition denial, cross-tenant transition
denial, anonymous transition denial, customer-token privilege denial,
status-history and booking-change write denial, stale/repeated transition
denial, reschedule confirmation invalidation, non-material edit regression,
cancellation confirmation invalidation, terminal locks, operational audit
events, and due/upcoming behavior.

The Phase 8 runtime test verifies valid feedback link view/submission, public
data minimization, duplicate/consumed submission behavior, invalid, expired,
revoked, and wrong-purpose token denial, non-completed booking denial,
cross-tenant feedback access denial, vendor feedback mutation denial, concurrent
submission behavior, issue create/resolve authorization, issue RLS/grants,
cross-tenant issue mutation denial, issue resolution concurrency, audit events,
and comment/token leakage controls.

Default Supabase email confirmation E2E requires `E2E_SIGNUP_EMAIL` to point at
a safe inbox. Without it, signup confirmation and reset-password completion
remain PARTIAL rather than using reserved domains or untrusted third-party
inboxes.

## Definition of Done

A feature is not complete simply because it compiles.

Future phase acceptance should generally require appropriate combinations of:

- Implementation.
- Lint.
- Typecheck.
- Tests.
- Production build.
- Security review.
- Documentation.
- Migration verification where applicable.
- Responsive behavior.
- Accessibility.
- Expected error handling.
