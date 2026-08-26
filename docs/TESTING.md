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
- Business-logo pending-state integration tests cover a 120-second stalled
  upload/removal bound, safe network/malformed-response recovery, same-file
  retry, immediate duplicate-submit prevention, and one-refresh success. Sharp
  regressions additionally cover EXIF rotation, metadata stripping,
  transparency, no small-image enlargement, and malformed input.
- Business-logo client-preparation unit/integration tests cover unchanged small
  sources, 2-4 MiB and 4-5 MiB preparation, exact 5 MiB acceptance, one-byte-over
  rejection before upload, JPEG/WebP output, transparent PNG handling, EXIF-aware
  decode, original dimension/pixel limits, MIME spoofing, decode/encode failure,
  30-second preparation timeout, stale cancellation, bounded multipart input,
  same-file recovery, and one-request duplicate protection.
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
- Transactional provider selection and Brevo/Resend adapter tests covering
  success IDs, HTML/plain text, deterministic idempotency, 401/403/429/500,
  network/timeout failure, malformed responses, invalid sender input, and
  fail-closed configuration.
- Static transactional-email boundary tests covering server-only secrets,
  domain neutrality, atomic claims, domain-state isolation, no sensitive
  logging, no contact/marketing APIs, and retained development/Resend support.
- Production activation requires a new controlled event after deployment. It
  must prove one claim, Brevo acceptance, bounded provider evidence, truthful
  Admin wording, and inbox outcome without replaying historical events. Resend
  standby uses a separate controlled send and never the same event.
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
- Trusted feedback share-message/intent and safe metadata unit tests; native,
  clipboard, WhatsApp, Telegram, and contextual panel integration tests; static
  service-only migration checks; and live idempotent open/direct-role denial.
- Structural loading component semantics, reduced-motion, stable variant, and
  request-cache policy tests.
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
- Logo E2E inspects onboarding and Business-page Storage output rather than only
  UI text: deterministic `logo.webp`, WebP decode, <=512px, <=200 KB, one object,
  replacement-content change, public retrieval, database reference, and removal
  cleanup. Replacement inspection uses a fresh query version because the
  deterministic public path can transiently return an earlier CDN object.
  Initial upload runs at desktop width and replacement/removal at mobile width.
  Current coverage selects an exact 5 MiB camera-resolution onboarding JPEG and
  a 4.8 MiB mobile replacement, inspects the actual multipart bodies below the
  3 MiB file plus bounded overhead, and proves a 5 MiB-plus-one-byte selection
  causes no logo request.
  Post-merge Production verification for `dd0fe2c` repeated exact-5 MiB
  onboarding and a 4.8 MiB 390px replacement. Multipart requests measured
  2,146,239 and 2,147,355 bytes; metadata-free final WebP objects measured
  58,946 and 58,838 bytes at 384x512. The replacement settled in 15.049 seconds
  under 180ms latency/1.2 Mbps upload throttling, >5 MiB sent no request, no
  console/overflow/413 failure occurred, and independent cleanup found zero
  controlled Auth, profile, business, or Storage leftovers.
  The post-merge production smoke for `faad4cb` repeated these checks at 1440px
  and 390px: four logo API operations returned 200, optimized objects decoded as
  WebP within policy, public reads returned 200, and independent cleanup found
  zero controlled business, profile, Auth-user, or Storage-object leftovers.
- Public confirmation identity coverage for persisted logo, fallback initials,
  safe website/Instagram links, unchanged booking/contact confirmation, and no
  visible tenant ID.
- Canonical confirmation sharing coverage for editable contextual copy,
  controlled URL copying, rendered Open Graph fields, hydrated first-open
  evidence, truthful vendor share-method state, and Telegram-style preview
  requests that receive no customer/order body or view evidence.
- Canonical feedback sharing coverage for private contextual copy, controlled
  link/message copying, native and social methods, crawler-safe metadata,
  idempotent ordinary-browser open evidence, audit truthfulness, and private
  submission on desktop and mobile projects.
- Lightweight governance tests for required documentation, the repository
  definition-of-done rule, and migration filename/order discipline.
- Playwright CI diagnostics sanitizer coverage for configured secrets, raw
  capability paths, OAuth values, JWTs, bearer tokens, and email addresses.

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
pass. Failed E2E runs retain a sanitized JSON report and textual error context,
while raw traces and media remain excluded because the suite traverses customer
capability URLs. The multi-business forged-switch regression performs its DOM
tampering and submission atomically so React hydration cannot replace the
forged value between separate browser tasks. Full details are in `docs/CI.md`.

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

## Feedback Sharing, Loading, And Performance - 2026-08-24

- Unit/component coverage pins private no-account-required feedback copy, safe
  message URL construction, all supported methods, native fallback, clipboard
  separation, crawler-safe metadata, structural loading accessibility, and
  request-only cache policy.
- Static and live security coverage verifies the applied migration, service-only
  grants, exact purpose/state checks, first-open idempotency, one truthful audit
  event, direct anonymous/authenticated denial, and no raw token in audit data.
- Canonical Playwright feedback flow now covers vendor sharing, crawler metadata
  without open evidence, ordinary browser open, submission, and vendor view on
  desktop and mobile projects. Existing purpose and tenant-isolation suites
  remain authoritative for negative paths.
- Query plans and real warmed local route timings are recorded in
  `docs/PERFORMANCE.md`; timings were network-variable, so no blanket speedup is
  claimed. The deterministic reduction is one authenticated/current-business
  resolution chain per server request.
- Final verification passed lint, strict typecheck, 46 ordinary Vitest files
  with 195 passing tests, 13 live runtime files with 14 passing tests, 34
  Playwright journeys with 6 intentional skips across desktop/mobile projects,
  production build, zero moderate-or-higher npm vulnerabilities, database lint
  with no findings, and `git diff --check`.

## Navigation And PWA Performance Deep Audit - 2026-08-24

- Three-run fresh-context browser profiles cover login, all seven required core
  transitions, business switching, and browser Back against separate local
  production and Vercel production targets. Timing assertions are not committed;
  measured medians are recorded in `docs/PERFORMANCE.md`.
- Unit policy coverage requires London function placement, the RLS-scoped
  membership/business relation read, embedded booking/customer and
  feedback/booking projections, the single dashboard analytics Suspense
  boundary, semantic Next links, and absence of an authenticated-route service
  worker cache.
- A controlled live Supabase probe verifies each embedded relationship returns
  the expected same-tenant row before the full runtime-security suite exercises
  cross-tenant denial and business switching.
- The full ordinary, runtime-security, desktop/mobile E2E, build, dependency,
  database-lint, and whitespace gates remain mandatory. No existing test is
  skipped, removed, or weakened for the optimization.
- Final local verification passed 47 ordinary Vitest files with 201 tests,
  13 live runtime-security files with 14 tests, 34 Playwright journeys with the
  repository's 6 intentional skips, lint, strict typecheck, production build,
  moderate dependency audit with zero vulnerabilities, and `git diff --check`.
  Database lint was unavailable because no Supabase CLI is installed and the
  connected advisor endpoint denied access; this pass contains no database or
  migration change.
- Pull request #10 was conflict-free and passed all seven active CI checks; its
  protected Runtime Security job was the expected skip, with the authoritative
  14-test live suite already green locally. Vercel promoted the matching merge
  commit to Production.
- Post-deployment verification separately covered desktop, mobile, and headed
  standalone app-window navigation; all required route transitions, business
  switching, browser Back, region headers, hashed static caching, CLS, LCP/TTFB,
  service-worker control, and horizontal overflow. Production medians are in
  `docs/PERFORMANCE.md`.

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

## Platform Admin Foundation Coverage

- `tests/unit/platform-admin-access-policy.test.ts` verifies strict role/status
  parsing and fail-closed malformed or disabled values.
- `tests/security/platform-admin-foundation.test.ts` statically verifies the
  migration, RLS/grants, caller scoping, audit trigger, and server-only boundary.
- `tests/security/platform-admin-runtime.test.ts` uses temporary development
  fixtures to prove ordinary, one-business, multi-business, disabled, anonymous,
  self-insert, self-update, metadata-forgery, and enumeration denial; it verifies
  active access and audit evidence, then removes every fixture.
- `tests/e2e/platform-admin.spec.ts` verifies unauthenticated login handling,
  vendor denial, active zero-business access, refresh persistence, disabled
  denial, and no overflow at 390, 768, and 1440 pixels.

## Platform Admin Operations Overview Coverage

- `tests/unit/admin-overview.test.ts` verifies strict aggregate parsing and
  deterministic attention-item derivation.
- `tests/security/platform-admin-overview-migration.test.ts` verifies the narrow
  RPC, active-admin predicate, grants, count semantics, server-only query
  boundary, and absence of PII, financial, and write surfaces.
- `tests/security/platform-admin-overview-runtime.test.ts` creates controlled
  two-business fixtures and verifies exact deltas for every Phase 2 metric.
  Amendments and add-ons prove the booking total counts booking rows only. It
  also proves ordinary multi-business, anonymous, and disabled-admin denial and
  removes all fixtures.
- `tests/e2e/platform-admin.spec.ts` additionally verifies aggregate rendering,
  zero-business access, metrics unchanged across two current-business cookies,
  vendor-workspace round trip, refresh persistence, and no overflow at 390, 768,
  1024, and 1440 pixels.

The live suite retains the existing `PHASE2_RUNTIME_VERIFICATION=1` and safe
`PHASE2_SUPABASE_TARGET` gate. Runtime-security files execute serially because
they share one controlled backend, use exact global aggregate baselines, and must
remain below project-wide Auth request limits. Assertions within each file are
unchanged. CI requires no static administrator credentials.

## Platform Admin Directory Coverage

- `tests/unit/admin-directory.test.ts` verifies bounded URL parameters, count
  normalization, page totals, provider labels, complete safe DTO parsing, and
  rejection of unexpectedly broad privileged responses.
- `tests/security/platform-admin-directories-migration.test.ts` verifies all
  four postgres-owned RPCs, active-admin checks, empty search paths, grants,
  allowlisted Auth fields, literal bounded search, server-only authorization,
  current-business independence, and the absence of writes or unsafe data.
- `tests/security/platform-admin-directories-runtime.test.ts` is retained behind
  the existing safe-target flags. It creates 22 businesses and four users,
  including multiple owners, a member, and a no-business user; verifies exact
  page/search/membership/operational counts and ordinary/anonymous/disabled
  denial; then removes all controlled fixtures.
- `tests/e2e/platform-admin.spec.ts` covers anonymous/vendor/disabled denial,
  active directory/detail access, debounced punctuation search, safe not-found,
  business-user-business cross-links, current-business independence, refresh,
  and no overflow at 390, 768, 1024, and 1440 pixels.

The runtime provider assertion covers password/email identities. Google provider
labeling is unit-covered; creating or linking a Google identity through service
fixtures would not be a faithful OAuth test and is therefore not manufactured.
Existing real Google OAuth E2E remains the vendor authentication regression.

Phase 3 accepted runtime evidence is non-destructive. Read-only production SQL
reconciled page totals, stable order, all directory and detail counts, all
implemented business search fields, user membership counts, and Auth provider
names against authoritative rows. It also proved case-insensitive/literal
punctuation search and business-user cross-link consistency. All four RPCs denied
an ordinary authenticated user, and anonymous execution failed at the grant
boundary.

One temporary auto-confirmed Auth user with zero business memberships received
exactly one temporary `ACTIVE SUPER_ADMIN` row. The actual local application
then passed overview, business/user search and pagination, both details,
bidirectional cross-links, current-business independence, refresh, logout, and
390/768/1024/1440 responsive checks against the configured project. Cleanup
removed its admin row, Auth user, profile cascade, and test-only authority audit;
an independent query confirmed zero leftovers and exactly one active production
admin.

After PR #15 passed all executable CI gates and merged as `4437a161`, Vercel
deployed that exact commit. A newly created controlled zero-business admin then
passed the same read-only journey against the production URL, including both
page-two transitions, bounded search, details, bidirectional cross-links,
refresh, logout, anonymous redirect, and 390/768/1024/1440 responsive checks.
The test deleted its authority row, Auth user, profile, and any actor audit rows;
an independent follow-up found zero matching temporary users/profiles and the
single approved active production `SUPER_ADMIN`.

The destructive 22-business runtime fixture suite remains available and gated
but was not run against production. Production currently has no multi-owner
business, so plural-owner preservation is verified statically and with a
two-owner DTO unit test. Disabled-admin and business-owner denial rely on the
unchanged authorization helper and prior verified platform-admin runtime and
production revocation evidence. No Docker/local Supabase result is accepted as
Phase 3 evidence.

## Platform Admin Booking And Issue Operations Coverage

- `tests/unit/admin-operations.test.ts` verifies bounded search/page/filter
  parsing, strict list/detail DTOs, effective-value fixtures, and rejection of
  directory descriptions or unexpected private fields.
- `tests/security/platform-admin-operations-migration.test.ts` verifies the four
  postgres-owned active-admin RPCs, grants/search paths, literal search, stable
  pagination, confirmed-add-on totals, minimized projections, read-only pages,
  and one-call query boundaries.
- `tests/security/platform-admin-operations-runtime.test.ts` is opt-in and
  production-safe: it creates temporary Auth/admin authority only, proves
  anonymous/ordinary/disabled denial and active-admin minimized reads against
  existing records, then removes authority audits, the admin row, and Auth users.
  It creates no tenant/domain fixture.
  Production-backed execution additionally requires the explicit
  `ADMIN_PHASE4_PRODUCTION_READ_VERIFICATION=1` and
  `PHASE2_SUPABASE_TARGET=production` pair; other runtime suites retain their
  existing non-production safe-target gate.
- `tests/e2e/platform-admin.spec.ts` extends route denial, safe not-found,
  navigation, and the 390/768/1024/1440 responsive matrix to Bookings and Issues.

The configured Supabase project is production-backed. No Docker stack is used,
and controlled booking/issue domain fixtures must not be created there for this
phase. The explicitly approved migration was applied transactionally. Anonymous
direct calls were denied for all four RPCs, while an existing approved
zero-business active admin completed the local application journey against live
data, proving that global reads are independent of vendor current-business state.
The temporary-admin runtime suite was blocked by execution risk controls before
it created any account, admin row, audit, or domain record; no workaround was
used. Ordinary-user, business-owner, and disabled-admin denial therefore rely on
the unchanged helper and prior verified platform-admin runtime/revocation
coverage. Existing production data covered effective confirmed-add-on totals,
cancellation evidence, feedback structure, email-state grouping, issue details,
search, filters, cross-links, safe not-found behavior, and responsive routes.
At direct verification time, production had no amendment rows, so amendment
rendering remained unit/static coverage rather than a manufactured runtime
result. No Docker/local Supabase or
production booking, issue, amendment, add-on, feedback, or email fixture was
created.

PR #17 passed all eight reported checks and merged as `edbef26`. Vercel marked
the deployment for that exact `main` commit ready. The existing approved
production admin session then rendered `/admin/bookings`, one booking detail,
`/admin/issues`, and one issue detail against live records; minimized fields,
masked confirmation contact, effective confirmed-add-on value, status history,
grouped email state, private issue detail, and cross-links were present as
designed. Browser diagnostics contained no warnings or errors. This production
smoke was read-only and created no Auth, admin, audit, booking, issue, amendment,
add-on, feedback, or email record.

## Platform Admin Email Operations Coverage

- `tests/unit/admin-email-operations.test.ts` verifies bounded URL presets,
  punctuation search, strict summary/detail DTOs, count normalization,
  pagination, health precedence, and rejection of privileged payload expansion.
- `tests/security/platform-admin-email-operations-migration.test.ts` verifies
  ownership, empty search paths, active-admin checks, grants, bounded literal
  filtering, stable pagination, one-call query boundaries, data minimization,
  and absence of writes or retry controls.
- `tests/security/platform-admin-email-operations-runtime.test.ts` is gated to
  explicitly safe non-production targets. It proves anonymous/ordinary/disabled
  denial, active-admin reads, strict output minimization, and before/after outbox
  immutability without creating email events.
- `tests/e2e/platform-admin.spec.ts` covers Email Operations route denial,
  navigation, malformed/not-found detail, current admin regression, and the
  390/768/1024/1440 responsive matrix after the migration is available.

Provider activation adds unit and static regression coverage without a real
network dependency. A live Brevo test is deliberately separate and must use one
new controlled Production event after sender/domain and Production-only Vercel
configuration. Unit mocks cover destructive credential failures; no real key is
corrupted. Historical events and customer addresses are never live-test input.

Exact four-state/filter fixture creation is not run against production and no
Docker/local Supabase stack is used. Production verification is read-only over
existing outbox data. Direct runtime checks pass for anonymous/ordinary/disabled
denial, active-admin projections, filters, data minimization, and outbox
immutability. Full Playwright passes with 35 tests and 7 intentional skips,
including the admin route and 390/768/1024/1440 matrix. Cleanup confirms zero
temporary admin/Auth leftovers and exactly one approved active `SUPER_ADMIN`.

## Admin MFA And Privileged-Action Coverage

- `tests/unit/privileged-platform-admin-policy.test.ts` covers ordinary AAL1,
  ordinary AAL2, business-owner AAL2, disabled-admin AAL2, active-admin AAL1,
  and active-admin AAL2 decisions. It also proves forged client fields are
  ignored, reasons are trimmed/bounded, failed-email retry is independently
  protected, and audit evidence has no arbitrary secret metadata.
- `tests/unit/admin-mfa-security.test.ts` accepts only supported assurance values,
  counts only verified TOTP factors, distinguishes incomplete enrollment, and
  ignores unrelated factor types.
- `tests/security/platform-admin-mfa-boundary.test.ts` locks signature-verified
  claims, current admin rechecks, native Supabase APIs, private route headers,
  absence of browser/local authorization flags and logs, explicit dialog action
  wiring, and the continued absence of retry or other admin mutations.
- `tests/integration/privileged-action-dialog.test.tsx` verifies the accessible
  application-owned dialog, consequence copy, explicit confirmation, cancel
  semantics, and required 500-character reason boundary.
- `tests/e2e/platform-admin.spec.ts` includes `/admin/security` in ordinary and
  disabled denial, active navigation, and the 390/768/1024/1440 matrix. Its
  mutating fixtures now require both explicit runtime opt-in and a declared
  non-production Supabase target; production credentials alone cannot run it.

Real enrollment verification must use a temporary Auth user plus exactly one
temporary active platform-admin row. It may create and remove a TOTP factor but
must not create business/customer/booking data or alter the approved production
admin. Cleanup must remove factor, admin row, profile, Auth user, and test-only
audits where safe. Docker is prohibited. A secret, QR payload, OTP, session, or
token must never appear in test output.

The controlled production-backed run followed that procedure. It proved native
TOTP enrollment, a safely rejected invalid code, verified-factor/AAL2 elevation,
the central privileged gate, immediate denial after temporary admin disablement,
logout/login reset to AAL1, a fresh successful challenge, and existing read-only
admin access at AAL1. Cleanup left zero matching Auth users, profiles, factors,
platform-admin rows, or actor audits and did not modify the approved production
admin or create business/domain fixtures. No Docker was used.

Local final gates passed: lint, typecheck, 318 tests with 18 intentional skips,
34 E2E tests with 8 intentional skips, build, zero moderate audit findings, and
`git diff --check`; runtime-security suites safely skipped under the configured
target guard. Codex Security reviewed all ten changed source surfaces with zero
findings. PR #27 and the separate `main` run passed Quality, Tests, Dependency
Security, Build, and E2E; Runtime Security remained intentionally skipped by its
configured CI gate. Vercel deployed merge `b90ab5f`, and authenticated production
security/read/session/vendor/responsive smoke passed at 390, 768, 1024, and 1440
pixels without browser warnings or errors.

## Booking Journey UX Coverage

- `tests/unit/booking-journey.test.ts` exhaustively maps every booking status,
  checks actions against the transition graph, proves the no-dead-end invariant,
  and covers feedback, cancellation, reconfirmation, amendments, and add-ons.
- Booking domain tests require total amount and prove an empty optional deposit
  normalizes to zero without changing integer minor-unit parsing.
- Booking form integration tests prove new total/deposit values are empty,
  delivery schedule wording is explicit, and persisted edit values remain.
- The canonical Playwright journey asserts current-step semantics, valid and
  absent-invalid actions, reconfirmation, attention context, feedback close,
  cancellation hierarchy, and zero overflow at 320, 360, 375, 390, 430, 768,
  1024, and 1440 pixels in desktop and mobile projects.
- Required CI passed Build, Tests, E2E, Dependency Security, and Quality for PR
  #21. Runtime Security was intentionally skipped by the protected configured
  backend's safe-target gate, matching the local 18-suite safe skip; the gate
  was not bypassed. After Vercel deployed merge `b26f0c4`, controlled production
  smoke used one isolated owner/business/customer/booking to verify the new form
  and `CONFIRMED -> IN_PROGRESS -> READY -> DELIVERED -> COMPLETED` UI path,
  feedback guidance, and all eight responsive widths. Cleanup verified zero
  temporary business or Auth-user leftovers.

## Booking Completion And Required-Logo Coverage

- `tests/unit/lifecycle-confirmation-policy.test.ts` prevents booking lifecycle
  UI from reintroducing browser-native blocking dialogs or popup windows and
  requires the owned completion dialog contract.
- `tests/unit/business-onboarding-logo-policy.test.ts` locks the no-logo create
  guard, persisted `logo_path` completion check, selection order, and established
  logo HTTP boundary.
- Existing logo unit/runtime suites continue covering image normalization,
  malformed/oversized/dimension rejection, deterministic paths, owner-only
  writes, and cross-tenant denial.
- Onboarding E2E blocks submit without creating a row, stages one business after
  a malformed upload, proves it remains incomplete across refresh, then recovers
  with optimized WebP without duplication. Multi-business E2E requires the same
  logo flow.
- Booking E2E proves dialog visibility, cancel without mutation, final
  completion, feedback guidance, and 320px containment without a browser dialog
  handler.
- Local verification passed lint, typecheck, 280 unit/integration/static tests,
  the safe-target runtime command, 35 E2E tests with 7 documented skips, build,
  moderate audit with zero vulnerabilities, and whitespace checks. A focused
  recovery E2E also removed the routing cookie before reload and completed the
  same persisted pending business.
- PR #23 passed Quality, Tests, Build, E2E, and Dependency Security; Runtime
  Security was intentionally skipped by the protected-backend safe-target
  policy. After Vercel deployed merge `9dae103`, one isolated production Auth
  user verified no-logo rejection without row creation, optimized first and
  additional logos, switching, completion Cancel/final paths and feedback at
  320px, and logo replace/remove/restore. Cleanup proved zero controlled Auth
  or business fixtures remained.

## Production Domain And Email Verification

- PR #25 passed Quality, Tests, Build, E2E, Dependency Security, and Vercel;
  Runtime Security was intentionally skipped by the protected-target gate.
  GitHub reported no conflicts before merge `25df3c5` deployed to Production.
- Canonical apex TLS, `www` permanent redirect, retained Vercel hostname, exact
  Supabase callbacks, Google OAuth, and email/password session behavior passed.
- Supabase Auth custom SMTP delivered controlled signup and recovery messages
  through the verified Brevo sender. Signup confirmation, zero-business routing,
  recovery callback, password update, old-password rejection, new-password login,
  session establishment, and logout passed on the canonical domain.
- One isolated booking confirmation created one durable event, claimed it once,
  persisted `SENT` with a provider ID and no failure, appeared in Admin Email
  Operations, and separately showed delivered/opened in Brevo and received in
  the controlled inbox. The historical pending event was not replayed.
- Cloudflare recorded one controlled `hello@mykustomers.com` message received and
  delivered/forwarded. Cleanup returned controlled business, customer, booking,
  email-event, and Auth-user counts to zero.
- Existing provider unit/static coverage remains the regression layer for Brevo
  failure classes and Resend standby behavior. No new test was required for this
  documentation-only verification follow-up because application behavior did not
  change after the already tested and merged implementation.

## Admin Safe Email Retry Coverage

- `tests/unit/email-retry-policy.test.ts` covers 429/5xx/proven connect failures,
  401/403/other 4xx, invalid recipient/sender/configuration, timeout, network,
  malformed response, unknown failures, evidence mismatch, every non-failed
  state, provider configuration, secure-link reconstruction limits, and
  attempt-scoped idempotency.
- `tests/unit/admin-email-retry-action.test.ts` mocks the provider boundary and
  proves one pinned-provider invocation, truthful success/failure results, no
  fallback, stale-claim denial, AAL1 denial before reads, and reason validation.
- `tests/security/admin-email-retry-migration.test.ts` locks RLS/grants,
  PENDING-only normal claims, event/attempt row locking, stale predicates,
  service-role-only mutation, sanitized audits, detail-only UI, and absence of
  bulk retry, provider switching, or domain writes.
- `tests/e2e/admin-email-retry.spec.ts` is explicitly opt-in. It creates a unique
  temporary Auth/admin/communication fixture, proves AAL1 denial, native TOTP
  AAL2, the 390/768/1024/1440 dialog matrix, and two-tab concurrency yielding
  exactly one development-provider invocation and one appended attempt. It
  checks booking immutability and audit privacy, then deletes all fixtures.
- Production-backed verification must never alter a real admin or historical
  customer event. Docker is prohibited. A final cleanup query must show zero
  `phase6b-*` users/businesses, zero temporary attempts, and one approved active
  `SUPER_ADMIN`.

## Customer Communication And Live Synchronization Coverage

- Unit tests cover reschedule/delivery content and privacy, stable booking
  subjects, opaque correlation headers, provider forwarding, secure-link retry
  exclusion, minimal state revisions, and confirmation/feedback notifications.
- Static migration-security tests cover enum scope, composite tenant foreign
  keys, uniqueness, atomic domain/event functions, and anonymous grant denial.
- The canonical E2E keeps separate vendor/customer tabs open to prove automatic
  confirmation and feedback refresh, one in-app notice per observed revision,
  minimized/no-store sync responses, not-found isolation, and durable
  reschedule/delivery event acceptance.
- Runtime/E2E uses the configured backend with controlled fixture cleanup.
  Docker/local Supabase is not used. PWA push is not tested because it is not
  implemented.

## Booking Lifecycle And Payment Recording Coverage

- Unit coverage validates positive minor-unit payment input and high-entropy
  operation IDs, plus journey behavior for outstanding, paid, and unavailable
  payment summaries.
- Integration coverage verifies authoritative totals/history, an accessible
  application-owned record-payment dialog, empty numeric input, and fail-closed
  summary behavior.
- Static migration coverage fixes append-only grants/RLS, composite tenant
  relationship, amount/idempotency constraints, security-definer search paths,
  atomic confirmation activation, and completion enforcement.
- Runtime coverage is guarded to explicit safe targets and uses temporary tenant
  fixtures only. It proves confirmation race/history, direct-write denial,
  anonymous/cross-tenant denial, operation retry idempotency, distinct concurrent
  final-payment serialization, overpayment denial, completion blocking and
  success, audit privacy, cancellation preservation, and cleanup.
- Canonical desktop/mobile E2E confirms immediate `IN_PROGRESS`, no Start work,
  early partial payment persistence through add-on/reschedule/reconfirmation,
  delivered completion unavailability, final reconciliation, completion, and
  feedback handoff. Docker/local Supabase is prohibited.
- PR #31 passed `Quality`, `Tests`, `Build`, `Dependency Security`, and `E2E`;
  the protected runtime job remained intentionally skipped by its safe-target
  guard while the separately opted-in controlled payment runtime suite passed.
  After Vercel deployed merge `c497d2e`, the canonical journey passed against
  `https://mykustomers.com` on production desktop and Pixel 5 viewports. The
  production-only assertion required a real non-development provider ID, and
  final cleanup found zero matching test businesses, bookings, payments, email
  events, memberships, profiles, or Auth users.

## Booking Detail Clarity And Contact Coverage

- Component tests verify required `Email address` labeling, concise booking-update
  helper copy, neutral placeholder, and optional phone semantics.
- Static migration coverage locks the existing empty-profile-only enrichment,
  immutable booking contact, and booking-contact-first notification rule.
- Disclosure unit/integration tests cover every lifecycle default, pending
  amendment/add-on priority, completed-feedback behavior, ARIA state, manual
  collapse persistence, independent expansion, and journey-anchor opening.
- Controlled E2E proves empty-profile enrichment, same-email behavior, different
  profile/booking contact separation, two bookings with distinct immutable
  contacts, provider recipient selection, full lifecycle actions, and no
  horizontal overflow across 320/360/375/390/430/768/1024/1440 widths.
- Playwright uses two workers so independent browser coverage remains parallel
  without overwhelming the shared guarded backend with unrelated fixture writes.
- No database migration or Docker fixture is required. Protected runtime suites
  retain their existing safe-target guards.
- Production verification ran the full canonical booking journey in desktop and
  Pixel 5 projects plus the desktop repeat-booking/different-contact path against
  `https://mykustomers.com`. All three passed with real Brevo provider acceptance,
  and the final controlled-fixture audit returned zero records and Auth users.

## Admin Security & Health Coverage

- `tests/unit/admin-health.test.ts` proves strict minimized DTO parsing,
  allowlisted/bounded activity, state precedence, attention deduplication,
  single-admin and MFA warnings, failure isolation, and unknown-not-green rules.
- `tests/integration/admin-security-health.test.tsx` covers textual status semantics,
  provider-acceptance wording, safe activity rendering, manual refresh, and
  partial-source failure rendering.
- `tests/security/platform-admin-health-migration.test.ts` locks function owner,
  empty search paths, grants, active-admin assertions, AAL1 read policy,
  current-business independence, query budget, public/admin health separation,
  privacy, and absence of writes/remediation.
- `tests/security/platform-admin-health-runtime.test.ts` is fixture-based and
  runs only on an explicitly safe non-production backend. It verifies
  anonymous/ordinary/owner/disabled denial, active-admin access, direct-RPC and
  client-forgery resistance, minimized payloads, and no operational row changes.
  It skips on the configured production-backed target by design.
- Admin E2E covers Security & Health navigation, states, manual refresh, all
  existing admin destinations, current-business independence, and no horizontal
  overflow at 390, 768, 1024, and 1440 pixels.
- Production verification is read-only and compares displayed aggregates with
  authoritative database evidence. Docker/local Supabase and destructive
  production fixtures are prohibited.
- Production `EXPLAIN (ANALYZE, BUFFERS)` measured 18.006 ms for the summary RPC
  and 51.864 ms for a 12-item activity RPC, with shared-buffer reads and no
  writes. Supabase Performance Advisor reported zero errors/warnings; Security
  Advisor reported zero errors and the existing generic self-authorizing
  `SECURITY DEFINER` warnings. Direct catalog/grant and denial tests remain the
  authoritative boundary evidence for the new RPCs.
- PR #39 CI passed Quality, Tests, Build, E2E, Dependency Security, and Vercel;
  Runtime Security retained the expected protected-production skip. The exact
  merge `d5bfb8f` deployed successfully. Authenticated canonical smoke covered
  all seven admin destinations, refresh, clean browser diagnostics, and current
  database-count agreement without creating or mutating a production fixture.
