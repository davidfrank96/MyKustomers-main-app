# Testing

## Status

STATUS: IMPLEMENTED AND VERIFIED, WITH DOCUMENTED PHASE 2 EMAIL EXCEPTIONS

The implemented Phase 1-9 surface has unit, static security, opt-in live
Supabase, and browser journey coverage appropriate to each feature. Public
signup confirmation and reset-password completion remain PARTIAL because they
require a controlled inbox and Supabase default-email delivery; those exceptions
do not reduce the verified tenant/RLS coverage.

## Test Categories

- Unit: Small deterministic utilities and isolated domain logic.
- Integration: Component and feature boundary behavior.
- End-to-End: Critical browser journeys.
- Security/authorization: Negative and cross-tenant access tests.
- Regression: Tests added for fixed bugs or high-risk behavior.
- Responsive structure: Required-width route smoke checks and focused overflow
  assertions without pixel-perfect snapshots.

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
- Business website normalization/safe-scheme tests and Sharp-backed PNG/JPEG/
  WebP validation, mismatch, byte, dimension, compression, and output-policy
  tests.
- Static business-identity migration/route tests and live Supabase Storage tests
  for owner replacement/removal, member/cross-tenant/anonymous denial, public
  retrieval, and non-enumerable anonymous listing.
- Phase 4 customer validation tests.
- Static Phase 4 customer migration/RLS review tests.
- Phase 4 runtime Supabase customer tenant security test.
- Phase 5 booking domain tests.
- Static Phase 5 booking migration/RLS review tests.
- Phase 5 runtime Supabase booking tenant security test.
- Inline customer booking discriminated-validation tests, static privileged-RPC
  checks, and live transaction/tenant/concurrency coverage.
- Phase 6 confirmation-link domain tests.
- Static Phase 6 confirmation migration/security review tests.
- Phase 6 runtime Supabase confirmation-link security test.
- Trusted confirmation share-message/intent and safe metadata unit tests,
  accessible dialog/clipboard/native fallback integration tests, static RPC
  grant checks, and live idempotent first-open/unauthorized-call coverage.
- Customer contact validation and booking-confirmed email template/provider
  boundary unit tests.
- Static customer-contact/email-outbox migration security tests.
- Confirmed-term material classification, cancellation reason, recipient
  priority, safe HTML/plain-text cancellation template, and outbox idempotency
  unit/static tests.
- Booking add-on validation, effective-total derivation, token/hash/expiry,
  privacy-safe sharing, request/confirmation email wording, static migration
  hardening, and live tenant/purpose/race/lifecycle/analytics coverage.
- Phase 7 booking lifecycle domain tests.
- Static Phase 7 operational lifecycle migration/security review tests.
- Phase 7 runtime Supabase operational lifecycle security test.
- Phase 8 feedback domain tests.
- Static Phase 8 feedback/issue migration/security review tests.
- Phase 8 runtime Supabase feedback and issue security test.
- Phase 9 analytics date-range, comparison, formatting, and definition tests.
- Static Phase 9 aggregate RPC migration/security review tests.
- Phase 9 runtime Supabase analytics correctness and tenant isolation test.
- Phase 9.5 UX audit, money-display regression tests, and canonical product
  journey coverage from customer creation through booking, confirmation,
  fulfilment, feedback, issue handling, and insights.
- Playwright tests for unauthenticated protected-route redirect, auth screen rendering,
  login, session persistence, logout, forgot-password safe response, redirect safety,
  business onboarding, customer create/edit/archive, and booking
  create/edit/customer-confirmation/reschedule/reconfirmation/complete,
  existing-customer and inline-new-customer booking creation,
  private feedback submission, operational issue create/resolve, and business
  insights.
- Playwright route-matrix overflow checks for public/auth pages at 320, 360,
  375, 390, 430, 768, 834, 1024, 1280, and 1440 pixels.
- Focused New Booking checks that preserve entered values and keep the inline
  duplicate-candidate action usable without horizontal overflow at every
  required width.
- Authenticated account/settings, business-logo/profile, and dashboard routes at
  320, 360, 375, 390, 430, 768, 1024, and 1440 pixels, including real logo
  upload/replacement/removal, website persistence, mobile logout, and dashboard
  tile destinations.
- Public confirmation identity coverage for persisted logo, fallback initials,
  safe website/Instagram links, unchanged booking/contact confirmation, and no
  visible tenant ID.
- Canonical confirmation sharing coverage for editable contextual copy,
  controlled URL copying, rendered Open Graph fields, hydrated first-open
  evidence, truthful vendor share-method state, and Telegram-style preview
  requests that receive no customer/order body or view evidence.
- Lightweight governance tests for required documentation, the repository
  definition-of-done rule, and migration filename/order discipline.

## Planned Critical Journeys

- E2E-001 - User can register. IMPLEMENTED AS ENV-GATED E2E TEST; PARTIAL in Phase 2V/2E because the configured Supabase project hit email constraints and no safe default-email inbox was configured.
- E2E-002 - User can login. VERIFIED.
- E2E-003 - User can logout. VERIFIED.
- E2E-010 - Business owner can create customer. VERIFIED.
- E2E-011 - Business owner can update customer. VERIFIED.
- E2E-020 - Vendor can create booking. VERIFIED.
- E2E-021 - Booking receives human-readable reference. VERIFIED.
- E2E-022 - Vendor can create a booking and its required customer inline,
  deliberately continue after an exact-match warning, and use the ordinary
  confirmation/contact-enrichment flow. VERIFIED.
- E2E-030 - Valid customer confirmation token works. VERIFIED.
- E2E-031 - Expired confirmation token fails. VERIFIED by runtime security test.
- E2E-032 - Revoked confirmation token fails. VERIFIED by runtime security test.
- E2E-033 - Consumed token cannot be reused where one-time use is required. VERIFIED.
- E2E-034 - Confirmed booking can be rescheduled and requires reconfirmation. VERIFIED.
- E2E-035 - Pending amendment leaves canonical terms unchanged, then customer
  Current/Proposed confirmation applies it on desktop and mobile. VERIFIED.
- E2E-036 - Public amendment diff has no horizontal overflow at 320, 360, 375,
  390, 430, 768, 1024, and 1440 pixels. VERIFIED.
- E2E-036A - Vendor can create and submit new linked scope, customer can confirm
  it through `/x/[token]`, and original confirmation evidence remains unchanged.
  VERIFIED.
- E2E-036B - Public add-on review has no horizontal overflow at 320, 360, 375,
  390, 430, 768, 1024, and 1440 pixels. VERIFIED.
- E2E-036C - One booking preserves its 45,000 original confirmation, applies a
  55,000 confirmed amendment, adds an independently evidenced 18,000 confirmed
  add-on, reports 73,000 current agreed value with booking count one, then
  cancels without rewriting any agreement layer. VERIFIED by live runtime test.
- E2E-037 - Confirmed booking can move through fulfilment to completion. VERIFIED.
- E2E-038 - Confirmation captures required email, optionally enriches the
  customer, and processes one event through the no-network development adapter.
  VERIFIED.
- E2E-040 - Completed booking can request private feedback. VERIFIED.
- E2E-041 - Customer can submit private feedback through a scoped link. VERIFIED.
- E2E-042 - Vendor can create and resolve an internal booking issue. VERIFIED.
- E2E-050 - Vendor can view tenant-private business insights from persisted
  records. VERIFIED.
- E2E-060 - Canonical vendor-to-customer product journey works end to end and
  feeds private insights. VERIFIED.

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
- SEC-TEST-010 - Business analytics aggregates cannot include or reveal another
  tenant's records. VERIFIED.
- SEC-TEST-011 - Inline booking creation rejects cross-tenant/archived customers
  and injected tenant authority, denies anonymous execution, and rolls back the
  customer and audits if booking creation fails. VERIFIED.

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

Responsive visual QA is documented in `docs/RESPONSIVE_QA.md`. The maintained
E2E assertion compares `document.documentElement.scrollWidth` with
`clientWidth` for representative routes; temporary screenshots are inspected
outside committed production assets.

Live-search regression coverage verifies the reusable 300 ms interaction rule.
Component tests use fake timers to prove that rapid typing produces one final
replace navigation rather than one navigation per character, compatible filter
and limit params survive, `page` is removed, clear is automatic, query values are
encoded, external URL changes synchronize without replaying a stale query, and
unmount cancels stale timers. Booking-form coverage verifies that debounced
active-customer candidates appear without submission and unrelated booking
fields retain their values.

Authenticated Playwright journeys exercise Bookings and Customers against the
configured development Supabase project. They verify first-character live
search, URL state, active/archive and booking-status composition, page reset,
clear-to-default behavior, visible picker candidates, selection, form-state
preservation, and zero horizontal overflow at 320, 360, 375, 390, 430, 768,
1024, and 1440 pixels. Existing Phase 4 and Phase 5 live runtime suites remain
the tenant-isolation evidence for customer and booking search queries.

All runtime suites use `tests/security/runtime-support.ts` for the shared
development-target allowlist, explicit opt-in guard, isolated non-persistent
Supabase clients, required environment checks, and no-row assertions. Feature
fixtures and assertions stay in their phase-specific suites.

The Phase 3 runtime test verifies authenticated RPC creation, unauthenticated
RPC denial, atomic rollback on invalid input, duplicate slug collision handling,
owner membership creation, owner update, member update denial, and cross-tenant
update denial.

The business-logo runtime test verifies the exact owner path, deterministic
upsert and delete, member and cross-tenant object denial, owner-only business
reference updates, anonymous upload denial, public object retrieval, and no
anonymous bucket enumeration. The first enabled run caught an onboarding RPC
overload ambiguity and a masked-email confirmation regression; the forward
`20260821132030` migration fixed both, after which all ten live suites passed.

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

The inline customer booking runtime test verifies existing-customer creation,
new and name-only customer creation, normalization, ordinary booking reference
and history behavior, required audit events without contact leakage, atomic
rollback, cross-tenant and archived customer denial, rejected business-ID
injection, tenant-isolated duplicate lookup, concurrent independent
transactions, anonymous denial, and compatibility with confirmation contact
enrichment on the same customer record.

The Phase 6 runtime test verifies confirmation token lifecycle, hash-only token
storage, public data minimization, GET lookup not consuming links, invalid token
handling, expired and revoked links, cross-tenant revoke denial, one-time
confirmation, confirmation evidence, snapshot/hash storage, material-change
invalidation, used-link snapshot stability, non-material internal-note edits,
cancellation invalidation, regeneration revocation, concurrent confirmation
behavior, persistent rate limiting, audit events, and raw-token non-logging. It
also verifies idempotent first-open recording, one `CONFIRMATION_OPENED` audit,
and denial of the first-open RPC to authenticated/anonymous clients. It
also verifies invalid contact does not consume a link, conservative customer
enrichment, immutable submitted contact, concurrent different-email winner
consistency, exactly one email event, provider-failure persistence,
cross-tenant/anonymous event denial, and contact-safe audit/public output.

The Phase 7 runtime test verifies controlled operational lifecycle transitions,
operational timestamps, invalid transition denial, cross-tenant transition
denial, anonymous transition denial, customer-token privilege denial,
status-history and booking-change write denial, stale/repeated transition
denial, reschedule confirmation invalidation, non-material edit regression,
cancellation confirmation invalidation, terminal locks, operational audit
events, and due/upcoming behavior.

The confirmed-booking integrity runtime test verifies crafted direct updates to
title, description, total, deposit, customer, and schedule are denied after
confirmation; internal notes remain editable; explicit rescheduling remains
valid; awaiting-customer material edits revoke open links; cross-tenant and
anonymous/customer-capability cancellation fail; confirmation evidence survives
cancellation; conflicting customer email loses to confirmation contact; two
concurrent cancellations produce one reason/history/audit/email event; and a
simulated provider failure leaves the booking `CANCELLED` with a retryable
`FAILED` event.

The Phase 8 runtime test verifies valid feedback link view/submission, public
data minimization, duplicate/consumed submission behavior, invalid, expired,
revoked, and wrong-purpose token denial, non-completed booking denial,
cross-tenant feedback access denial, vendor feedback mutation denial, concurrent
submission behavior, issue create/resolve authorization, issue RLS/grants,
cross-tenant issue mutation denial, issue resolution concurrency, audit events,
and comment/token leakage controls.

The Phase 9 runtime test verifies exact aggregate metric correctness from
persisted fixtures, tenant aggregate isolation, cross-tenant RPC denial,
currency separation, cancelled/draft value exclusion, feedback metrics, issue
distribution, overdue calculation, on-time behavior against current schedules,
and safe membership enforcement.

The booking-amendments runtime test verifies structured old/proposed evidence,
no canonical mutation while pending, confirmation-contact recipient priority,
one-active replacement, tenant read/create/revoke denial, anonymous service-RPC
denial, confirmation/amendment/feedback purpose separation, safe public view,
concurrent idempotent confirmation, one applied history/audit/email effect,
direct material-edit regression, request/confirmation provider-failure
persistence, original confirmation preservation, updated effective analytics
without double counting, vendor revoke, cancellation revocation, stale-base
denial, and expiry. Static and unit tests cover RLS/grants/search paths,
constraints, validation, share privacy, template escaping, and payment wording.

The booking-addons runtime test verifies amount and parent/currency constraints,
draft/pending exclusion, inherited schedule/contact, tenant authorization,
one-awaiting and amendment-conflict rules, regenerated-link revocation,
confirmation/amendment/feedback/original purpose separation, safe view/open,
concurrent confirmation idempotency, direct mutation denial, confirmed
immutability, request/confirmation provider-failure persistence, multiple
confirmed add-on totals/deposits with unchanged booking count, pending cleanup on
reschedule/READY/cancellation, and preservation of confirmed add-on plus original
confirmation evidence after parent cancellation.

The Phase 9.5 UX audit verifies the completed product surface at mobile widths
375px, 390px, and 430px, tablet width 768px, and desktop width 1365px. It
checks authenticated navigation, empty states, owner/customer language, booking
state hierarchy, public confirmation and feedback pages, natural NGN display,
and the canonical E2E journey through insights. The audit findings live in
`docs/UX_AUDIT.md`.

Default Supabase email confirmation E2E requires `E2E_SIGNUP_EMAIL` to point at
a safe inbox. Without it, signup confirmation and reset-password completion
remain PARTIAL rather than using reserved domains or untrusted third-party
inboxes.

## Production Deployment Verification

The initial Vercel deployment at `my-kustomers-main-app.vercel.app` was verified
against the existing development Supabase project with self-cleaning controlled
fixtures. The live hostname passed the canonical customer, booking, original
confirmation, amendment, add-on, fulfilment, feedback, outbox, and insights
journey; focused customer/booking live search; and the mobile account, dashboard,
logo Storage, logout, and protected-route journey at 390px and 1440px.

Additional HTTP checks verified HTTPS, `/api/health`, the manifest and declared
icons, no localhost URL in public HTML, and no-store/noindex behavior on `/c`,
`/a`, `/x`, and `/f`. The canonical metadata assertions verified the production
hostname and absence of customer PII. Vercel logs for the verification window
contained no Warning, Error, or Fatal events. Production smoke tests are not
part of ordinary CI because they use live infrastructure and one-time capability
links; follow `docs/DEPLOYMENT.md` for authorization, execution, cleanup, and
reporting.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests into and pushes to `main`:

- Quality: lint, typecheck, and changed-file whitespace integrity.
- Tests: unit, integration, static security, governance, and migration naming.
- Build: production Next.js build without privileged runtime secrets.
- Dependency Security: moderate-and-higher npm advisory gate.
- E2E: Chromium and all ordinary Playwright journeys using required dedicated
  non-production Supabase secrets; controlled-inbox signup remains optional.
- Runtime Security: the live runtime regression suite, guarded until the protected
  `supabase-runtime-security` environment and enable variable are configured.

The core E2E job validates required secret presence so missing credentials do
not silently turn all authenticated product journeys into skips. Runtime
Security remains explicitly configuration-pending rather than manufacturing a
pass. Full details are in `docs/CI.md`.

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

## Multi-Business Verification - 2026-08-24

- Unit selection tests cover zero, one, multiple, restored, missing, and stale
  business preferences.
- Static migration tests require exact `p_business_id` membership validation,
  hardened search path, and authenticated-only execution.
- The focused live inline-booking suite passed after the development migration,
  including an authorized second-business write and unrelated-tenant denial.
- `tests/e2e/multi-business.spec.ts` passed in desktop Chromium and mobile
  Chromium. It verifies switching, owner/member UI permissions, customer and
  booking isolation, a forged server-action submission, stale-cookie fallback,
  revoked-membership fallback, additional-business creation, and immediate
  current-business selection.
- Responsive shell/switcher checks passed at 320, 360, 375, 390, 430, 768,
  1024, and 1440 pixels without horizontal overflow; mobile navigation remains
  five items.
- The full lint, typecheck, Vitest, runtime-security, Playwright, build, and
  moderate audit commands passed: 40 Vitest files plus 13 live runtime files,
  28 Playwright tests with 6 intentional skips, production build, and zero
  moderate-or-higher npm vulnerabilities.

## Business Discoverability And Google Auth - 2026-08-24

- Business-page E2E covers one and multiple memberships, owner/member labels,
  textual current state, switching through the shared action, additional-business
  navigation, forged-selection denial, tenant data changes, and 320-1440px
  overflow/touch-target checks.
- OAuth unit tests pin provider `google`, the configured application callback,
  local-only `next` normalization, and trusted Supabase authorization origin/path.
- Auth E2E verifies the Google control on login/signup, disabled-provider
  fail-closed behavior, callback cancellation/error redaction, unchanged password
  login/logout/protected routes, and a controlled Auth user with OAuth-style
  metadata receiving a profile and normal zero-business onboarding.
- The configured development project's public Auth settings report Google
  enabled. Login and signup controls are enabled, and a real browser journey
  reached Google through Supabase without Gmail, Drive, Calendar, Contacts, or
  other unrelated scopes.
- Supabase returned through the requested local callback without manual code
  forwarding. The real journey verified PKCE exchange, one Google Auth user, one
  provisioned profile, zero-membership onboarding, refresh persistence, logout,
  and protected-route denial.
- The same Google session created one and then two active memberships, routed to
  the selected workspace, switched businesses, and retained that selection after
  refresh. Required CI passed, and the merged production deployment repeated the
  OAuth callback, multi-business resolution, switching, persistence, logout, and
  protected-route checks. CI does not automate the external Google consent UI.
- The completed local gate passed lint, strict typecheck, 42 ordinary Vitest
  files with 177 tests, 13 live runtime-security files with 14 tests, 34
  Playwright journeys with 6 intentional skips, production build, moderate npm
  audit with zero vulnerabilities, database lint with no findings, and
  `git diff --check`. Controlled E2E user-prefix count was zero after cleanup.
- This provider-activation check added focused callback regressions for a missing
  authorization code with malformed `next`, protocol-relative/external
  destinations, and the safe dashboard fallback. The external allowlist itself
  remains configuration-only and is not simulated in CI; existing live
  runtime-security, responsive, password-auth, callback security, and
  multi-business coverage remains the broader regression boundary.
- A Next-config unit regression requires the OAuth callback logging exclusion.
  A live dummy callback emitted no incoming-request line while `/login` remained
  logged, confirming that ordinary development diagnostics were not disabled.
