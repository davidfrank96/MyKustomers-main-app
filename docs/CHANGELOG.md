# Changelog

## 2026-09-01 - Authentication And Onboarding Integrity Hotfix

Status: VERIFIED - LOCAL RELEASE GATE

- Corrected a server-authorization gap where the shared dashboard layout could
  render the vendor shell without a current business and Settings lacked its own
  zero-business redirect. A safe post-login `next=/settings` could therefore
  admit a newly authenticated zero-business user to a normal workspace surface.
- Added one provider-independent post-auth destination resolver and one
  pre-shell vendor workspace gate backed only by active `business_members` and a
  completed current business. Password, Google callback, immediate signup,
  password-reset, and already-authenticated Auth-page paths now converge.
- Moved `/onboarding` outside the vendor route group, preserving the existing
  first-business, mandatory logo, resumable partial-setup, and existing-business
  behavior without changing the approved onboarding presentation.
- Membership query/data-integrity failures now fail closed instead of being
  collapsed into a zero-row onboarding result. Request-scoped memoization, leaf
  authorization, RLS, public capabilities, and the independent Platform Admin
  active-role exception remain unchanged.
- Added zero/one/member/multi/revoked state coverage, direct vendor-route and
  forged-cookie attacks, a stale Server Action after last-membership revocation,
  admin exception checks, safe-redirect checks, and vendor-shell absence checks.
- Local release verification passed lint, route type generation, strict
  TypeScript, 608 unit/integration/static tests, 46 executable browser journeys,
  the production build, dependency audit, and diff hygiene. Twenty live-runtime
  tests and 15 browser cases retained their documented protected-target or
  project guards.
- The independent fixture audit exposed silent historic cleanup debt. Seventeen
  controlled E2E businesses and 19 controlled Auth users plus their dependent
  rows/logo objects were removed, the responsible hooks were corrected to delete
  memberships before businesses, and the post-cleanup audit returned zero.
- No database migration, environment, dependency, provider, Docker,
  infrastructure, public-capability, or production-data change is included.

## 2026-08-31 - Master Release-Candidate Audit And Brand Consistency

Status: IMPLEMENTED - LOCAL RELEASE GATE VERIFIED

- Ran the existing `ui/mobile-redesign` worktree through core validation,
  canonical browser journeys, the authenticated nine-width route matrix,
  production-build bundle measurement, cold/warm navigation sampling,
  dependency audit, cache/loading review, accessibility review, security
  boundary review, and transactional-email smoke coverage.
- Added the missing 1280x800 authenticated matrix width and made the dashboard
  due-today fixture independent of the local time of day. The latter had caused
  a correct post-4:30 PM overdue count to fail against a hard-coded test value.
- Standardized all current runtime, public capability, installed-PWA, metadata,
  admin, authentication, sharing-state, and current-documentation branding on
  `My Kustomers`, `MyKustomers.com`, and the `MK` mark. Internal package names,
  database identifiers, and protocol headers remain unchanged.
- Preserved request-scoped tenant/auth deduplication, non-cacheable capability
  routes, default Next.js prefetch, route streaming, lifecycle rules, payment
  integrity, RLS, and service-role boundaries. No schema, migration, dependency,
  environment, deployment, production-data, or infrastructure change is included.
- Measured before considering optimization. The current route client JavaScript
  remains 70.9-108.9 KiB gzip for the primary vendor surfaces, cold local LCP was
  344-880 ms, and the constrained 1.2 Mbps mobile samples remained visually
  stable. No speculative performance rewrite was justified.

## 2026-08-31 - Operational Timeline Presentation Redesign

Status: IMPLEMENTED - BRANCH REVIEW PENDING

- Refactored the existing Booking-detail Operational timeline into a compact,
  semantic vertical timeline with aligned nodes, adaptive connectors,
  type-appropriate Lucide icons, an informational callout, real timestamps, and
  accurate booking-activity helper copy.
- Preserved the existing dynamic event count, human labels, optional detail,
  oldest-to-newest ordering, empty state, disclosure behavior, and all current
  status, reschedule, amendment, and add-on records.
- Added focused integration coverage plus canonical mixed-event responsive and
  screenshot gates across 320, 360, 375, 390, 430, 768, 1024, and 1440 pixels.
- No event generation, lifecycle, confirmation, payment, delivery, feedback,
  issue, authorization, tenant, RLS, database, API, or infrastructure behavior
  changed.

## 2026-08-28 - Approved Mobile Workspace Redesign

Status: IMPLEMENTED - BRANCH REVIEW PENDING

- Applied the locked mobile redesign references to Dashboard, Bookings, Booking
  detail, Customers, Insights, Business, and Add another business while keeping
  the repository as the functional source of truth.
- Added shared compact workspace page/section primitives, grouped list rows,
  progressive booking filters, an action-first booking journey, consistent
  neutral surfaces, and a compact authenticated shell with exactly five primary
  mobile destinations.
- Preserved all existing booking lifecycle, confirmation, payment, customer,
  analytics, business-switching, onboarding, logo, pagination, search,
  authorization, and multi-tenant behavior. No generated-reference-only feature
  was added.
- Added focused component/policy coverage and a self-cleaning controlled E2E
  matrix across seven routes and 320, 360, 375, 390, and 430 pixels, including
  long identifiers, long names, large NGN values, and expanded booking detail.
- No database, migration, environment, dependency, API, security-policy,
  infrastructure, production-data, or deployment change is included. The branch
  is intentionally unmerged pending visual review.

## 2026-08-27 - Sentry Production Observability

Status: IMPLEMENTED - PRODUCTION VERIFICATION PENDING

- Added the current Sentry Next.js App Router SDK for browser/server errors,
  request errors, global/admin render boundaries, route transitions, release
  association, and build-time source maps.
- Added one centralized fail-closed privacy policy for capability URLs, query
  strings, contact/tenant fields, credentials, request data, breadcrumbs,
  transactions, spans, and stack-frame variables.
- Kept error capture at 100% and routine tracing at a bounded 5%; health checks,
  Session Replay, user feedback, profiling, logs, metrics, cron monitors, and
  tunneling remain disabled.
- Hardened the Sentry project with IP storage prevention, default plus additional
  sensitive-field scrubbing, exact Production origin restrictions, and disabled
  fallback JavaScript source fetching. Existing spike protection and one
  high-priority email alert remain unchanged.
- Added focused unit/security assertions. No database, Supabase, service worker,
  admin UI, product workflow, Docker, or customer-data change is included.
- Production-only Vercel configuration, source-map upload, release inspection,
  controlled client/server event verification, PR/CI, and deployment remain
  pending at this entry.

## 2026-08-27 - PWA Resume Reliability And Stale-State Protection

Status: IMPLEMENTED - REAL IOS VERIFICATION PENDING

- Added one authenticated-shell coordinator for 30-second meaningful resume,
  persisted-page restoration, offline/reconnect awareness, and bounded
  authoritative server reconciliation.
- Preserved changed forms and open dialogs instead of refreshing over user work;
  offline writes remain blocked and are never queued or replayed.
- Reduced booking visible-tab polling from 5 seconds to 10 seconds and delegated
  lifecycle refresh to one booking reconciliation path that also refreshes
  payment/amendment/add-on state.
- Added safe-area shell/sheet spacing, fixed-bottom-nav content clearance, and
  deterministic Chromium, Pixel-class Chromium, and iPhone-class WebKit tests.
- Added no-service-worker, tenant-switch, expired-session, Back, HEIC rejection,
  offline navigation recovery, dirty-form, and stale-state coverage.
- No database, environment, dependency, service worker, private cache, Docker,
  Supabase, Vercel, Admin Phase 8, or infrastructure change is included.
- Physical iOS and Android devices were unavailable. WebKit/iPhone and Android
  browser evidence is emulated and must not be reported as real-device proof.
- PR #43 passed seven executable checks with one expected protected Runtime
  Security skip, merged conflict-free as `b0bd805`, and deployed that exact
  commit to Vercel Production.
- Controlled canonical production journeys passed in desktop Chromium, Pixel 5
  Chromium emulation, iPhone 13 WebKit emulation, and a Chromium app window.
  The app window did not advertise CSS standalone display mode and is not
  reported as an installed Android device.
- Fixed silent E2E fixture-cleanup failures by ordering dependent deletions and
  checking every result. The six controlled businesses and three Auth users
  found by the independent audit were removed; the final audit returned zero.

## 2026-08-27 - Authenticated Navigation Performance V2

Status: VERIFIED - PRODUCTION

- Added immediate accessible pending state to desktop and mobile vendor
  navigation, with same-destination duplicate-click suppression and no router,
  history, modifier-click, or framework-prefetch replacement.
- Added destination-named structural loading for primary vendor routes and
  streamed authorized Bookings/Customers shells before their paginated rows.
- Streamed customer feedback and booking operational issues as bounded secondary
  content while preserving primary booking lifecycle/payment correctness.
- Started layout auth/current-business work together while retaining one
  request-scoped verified-claims chain and all membership/RLS enforcement.
- Controlled production baseline found 8-11 ms generic acknowledgement,
  314-352 ms primary-route useful medians, 361-661 ms focused detail results,
  and meaningful remote outliers. Final exact route-manifest change stayed
  between -133 and +286 gzip bytes.
- No database, environment, dependency, explicit prefetch, telemetry, cache,
  service-worker, Edge, or infrastructure change is included. RUM remains a
  separately approved first-party follow-up.
- PR #41 passed seven executable checks with one expected protected Runtime
  Security skip, merged conflict-free as `d2f55fd`, and deployed to Vercel
  Production.
- Production after-measurement reduced Bookings/Customers destination-shell
  medians from 314-324 ms to 12-14 ms while useful rows remained 315-327 ms.
  Booking detail improved to 465 ms desktop and 501 ms mobile. Standalone
  Dashboard-to-Bookings showed a 14 ms shell, 327 ms useful rows, and 143 ms
  settled Back restoration.
- Focused Nigeria typical/constrained checks kept useful lists within 321-626 ms,
  detail usability within 545-763 ms, and business switching within 311-372 ms.
  Final cleanup verified zero controlled fixture rows and removed the temporary
  Auth user.

## 2026-08-26 - Admin Phase 7 Security And System Health

Status: VERIFIED - PRODUCTION

- Added a server-first `/admin/security` operational view with deterministic
  `OPERATIONAL`, `ATTENTION`, `DEGRADED`, and `UNKNOWN` states, prioritized
  attention, core services, email/outbox evidence, issue/booking aggregates,
  recent minimized security activity, current MFA posture, and safe deployment
  context.
- Added two approved production read-only RPCs with active-admin assertions,
  postgres ownership, empty search paths, bounded results, and no PUBLIC/anon
  execute. No tables, rows, indexes, enums, RLS policies, or existing data were
  changed.
- Preserved AAL1 read access and the Phase 6A AAL2 privileged-action boundary.
  Phase 6B remains the only admin write and remains production-verification
  pending.
- Added strict DTO/privacy, deterministic aggregation, partial-failure, refresh,
  direct-RPC denial, tenant-independence, accessibility, and responsive E2E
  coverage. Fixture runtime coverage stays guarded away from production.
- No Docker, local Supabase, provider probe, RUM, SIEM, vulnerability scanner,
  remediation, infrastructure control, environment change, or Admin Phase 8 is
  included.
- PR #39 passed every required executable CI check with the expected protected
  Runtime Security skip, merged conflict-free as `d5bfb8f`, and deployed that
  exact commit to Vercel Production. Authenticated canonical-domain smoke,
  manual refresh, all admin destinations, clean browser diagnostics, a separate
  authoritative read-only aggregate comparison, and the exact-code four-width
  E2E matrix passed without production fixtures or row mutation.
- The planned foundational admin roadmap is complete. Admin Phase 6B remains
  `IMPLEMENTED - VERIFICATION PENDING`; no Admin Phase 8 was started.

## 2026-08-26 - Business Logo 5 MiB Source Transport Pipeline

Status: VERIFIED - PRODUCTION

- Raised the user-selected PNG/JPEG/WebP source limit to 5 MiB without sending a
  raw 5 MiB multipart body through Vercel. One browser-native helper leaves
  sources at or below 3 MiB unchanged and preprocesses larger sources to a
  metadata-free, <=2048px JPEG/WebP transport intermediate under 3 MiB.
- Preserved transparency, EXIF-aware browser decode, the original
  6000px/25-megapixel product guard, stale-selection cancellation, a bounded
  preparation lifecycle, same-file retry, and one-request submission.
- Kept the server authoritative for received-content validation, Sharp decode,
  metadata stripping, 512px/200 KiB final WebP policy, owner authorization,
  Storage RLS, and deterministic replacement. No raw/intermediate object is
  stored.
- Added exact-5 MiB onboarding, 4.8 MiB mobile replacement, actual multipart,
  > 5 MiB no-request, and focused client/server regression coverage. No database,
  > Storage-bucket, environment, dependency, Docker, or Admin Phase 7 change is
  > included.
- PR #37 passed seven executable GitHub/Vercel checks with the protected Runtime
  Security job safely skipped, remained conflict-free, and merged as `dd0fe2c`.
  Vercel deployed that exact commit to Production. On `mykustomers.com`, an
  exact 5 MiB EXIF-oriented source produced a 2,146,239-byte multipart request
  and 58,946-byte 384x512 WebP; a 4.8 MiB mobile replacement produced a
  2,147,355-byte request and 58,838-byte 384x512 WebP in 15.049 seconds under a
  controlled 1.2 Mbps upload profile. A 5 MiB-plus-one-byte selection sent zero
  requests. No metadata, console errors, overflow, or 413 occurred, and cleanup
  confirmed zero temporary Auth, profile, business, or Storage leftovers.

## 2026-08-26 - Business Logo Upload Pending-State Hotfix

Status: VERIFIED - PRODUCTION

- Bounded the shared onboarding/Business-page logo request at 120 seconds and
  made network, malformed-response, and timeout failures terminate in a safe,
  recoverable UI state instead of leaving `Saving...` active indefinitely.
- Added an immediate in-flight guard, same-file retry support, request abort on
  unmount, and robust response parsing without changing owner authorization,
  Storage RLS, deterministic replacement, removal ordering, or image limits.
- Confirmed both product flows already converge on the same owner-authorized
  route and Sharp pipeline. Expanded regression coverage for timeout/failure
  recovery, duplicate submission, EXIF rotation, metadata stripping,
  transparency, no upscaling, malformed input, and persisted WebP invariants.
- No database migration, environment change, Docker, raw-original storage,
  broad UI redesign, or Admin Phase 7 work is included.
- PR #35 passed all required CI and merged conflict-free as `faad4cb`. Vercel
  deployed that exact merge; a controlled production user passed onboarding
  upload at 1440px, replacement and removal at 390px, desktop re-upload, public
  retrieval, deterministic-object replacement, and optimized WebP policy
  checks. Cleanup and an independent audit confirmed zero temporary business,
  profile, Auth-user, or Storage-object leftovers.

## 2026-08-26 - Booking Detail Clarity And Contact Email UX

Status: VERIFIED - PRODUCTION

- Replaced the public confirmation question-style email label with a required
  `Email address` label, `you@example.com` placeholder, and concise explanation
  that the address receives updates for this booking.
- Preserved the existing contact model: empty profiles may be enriched, different
  existing profile emails remain unchanged, and each booking retains its own
  immutable confirmation contact for notification selection.
- Kept Booking Journey visible and converted ten secondary booking-detail areas
  into independently accessible disclosures with concise summaries, one
  contextual default-open section, and journey-anchor opening.
- Added unit, integration, static security, repeat-booking E2E, live-update, and
  320-1440 responsive regression coverage. No migration, environment change,
  Docker, lifecycle rewrite, multi-email model, or Admin Phase 7 work was added.
- PR #33 passed all required CI and merged conflict-free as `84aa736`. Vercel
  deployed that exact merge, and controlled production desktop/mobile lifecycle
  plus repeat-booking contact smokes passed with real Brevo acceptance evidence.
  Final cleanup confirmed zero controlled fixture records or Auth users.

## 2026-08-26 - Booking Lifecycle Simplification And Payment Recording

Status: VERIFIED - PRODUCTION

- New customer confirmations now preserve `CONFIRMED` evidence/history and
  atomically finish in `IN_PROGRESS`; normal Start work UI is removed while
  legacy `CONFIRMED` rows and backend compatibility remain unchanged.
- Added append-only `booking_payments`, authoritative currency-specific payment
  totals, idempotent locked recording, safe audit evidence, tenant/anonymous
  denial, and no ordinary update/delete authority.
- Added a restrained payment summary/history and accessible record-payment
  dialog for `IN_PROGRESS`, `READY`, and `DELIVERED`. My Kustomers records money
  reported as received but does not process or verify payment.
- `DELIVERED -> COMPLETED` now rechecks authoritative outstanding under lock and
  rejects completion until zero. No backfill, force-complete, correction,
  refund, credit, waiver, environment change, Docker, or Admin Phase 7 work was
  added.
- Added unit, integration, static migration-security, guarded runtime-security,
  and canonical desktop/mobile E2E regression coverage.
- PR #31 passed all required CI and merged conflict-free as `c497d2e`. Vercel
  deployed that exact `main` commit; controlled production desktop/mobile
  journeys passed the full confirmation, fulfilment, payment reconciliation,
  completion, and feedback path with real Brevo provider acceptance. Cleanup
  confirmed zero controlled booking or Auth fixtures remained.

## 2026-08-26 - Customer Communication And Live Booking Synchronization

Status: IMPLEMENTED - PRODUCTION VERIFICATION PENDING

- Added visibility-aware, tenant-scoped booking-detail refresh and in-app
  notifications for customer confirmation and private feedback without a
  Realtime publication, service worker, browser push, or tenant cache.
- Added atomic `BOOKING_RESCHEDULED` and `BOOKING_DELIVERED` outbox events,
  replacement confirmation links for previously confirmed reschedules, safe
  templates, and existing Admin Email Operations visibility.
- Added stable booking subject families and opaque provider-neutral correlation
  headers. Standard RFC threading is not claimed because Brevo rejects standard
  headers and no verified RFC message identifier is persisted.
- Kept Brevo primary, Resend standby, one event/one provider, no failover, and
  Admin Phase 6B at implementation/production-verification pending.
- Added unit, static migration-security, and canonical two-tab E2E coverage. No
  Docker, new environment variable, service worker, or Admin Phase 7 work.

## 2026-08-26 - MFA-Gated Safe Failed-Email Retry

Status: IMPLEMENTED - PRODUCTION DEPLOYMENT VERIFICATION PENDING

- Added one centralized retry policy that distinguishes proven retryable
  non-acceptance from ambiguous and permanent/configuration/recipient failures.
- Added provider-pinned delivery-attempt history, a service-role-only atomic
  retry claim/finalize boundary, attempt-scoped idempotency, and truthful
  requested/succeeded/failed audit evidence.
- Added one email-detail action requiring an active `SUPER_ADMIN`, server-verified
  AAL2, explicit application confirmation, and a bounded required reason. There
  is no provider switch/failover, bulk/force retry, recipient/content editing, or
  domain mutation.
- Added policy/action/provider-mock/static-security coverage and an opt-in
  production-backed E2E proving AAL1 denial, native TOTP AAL2, four responsive
  widths, two-tab one-send concurrency, preserved evidence, audit privacy,
  booking isolation, and complete cleanup without Docker.

## 2026-08-26 - Admin MFA And Privileged-Action Framework

Status: VERIFIED - PRODUCTION

- Added active-admin-only `/admin/security` using native Supabase TOTP
  enrollment, factor listing, challenge/verify, verified-factor status, and
  current/next assurance without persisting MFA secrets.
- Added `requirePrivilegedPlatformAdmin()` to combine current database-backed
  `ACTIVE SUPER_ADMIN` authority with signature-verified AAL2. Existing admin
  reads continue at their established authorization level.
- Added a reusable accessible privileged confirmation dialog, optional bounded
  reason capture, a typed allowlisted audit-evidence contract, and an explicit
  unimplemented failed-email retry policy for later Phase 6B review.
- Added authorization-matrix, client-forgery, factor parsing, secret/logging,
  cache-header, dialog, E2E route, and production-fixture guard regressions.
- Added the sole-admin recovery runbook. No migration, environment variable,
  vendor MFA requirement, retry, suspension, deletion, membership mutation,
  booking override, impersonation, Docker, or new infrastructure is included.
- Controlled production-backed native TOTP enrollment, invalid-code denial,
  AAL2 elevation, disablement revocation, logout/login reset, and cleanup passed
  with a temporary zero-business admin and zero leftovers. PR #27 and its
  separate `main` run passed required executable CI, merged conflict-free as
  `b90ab5f`, and Vercel Production plus authenticated security/read/responsive
  smoke passed without changing the approved production admin.

## 2026-08-25 - Production Domain And Email Infrastructure

Status: VERIFIED - PRODUCTION

- Attached `mykustomers.com` and `www.mykustomers.com` to Vercel Production,
  issued valid TLS, made the apex canonical, preserved the original Vercel
  hostname, and added exact custom-domain Supabase Auth callbacks.
- Verified Cloudflare inbound routing for `hello@mykustomers.com`, Brevo root
  domain and professional sender authentication, and Resend standby-domain
  readiness without changing unrelated DNS records.
- Configured Brevo as Production application provider and Resend as scoped
  standby through server-only Vercel values. Automatic failover, historical
  replay, marketing synchronization, infrastructure, and database changes remain
  absent.
- Enabled Supabase custom SMTP with the verified My Kustomers sender through
  Brevo. Controlled signup confirmation, recovery, password update, old/new
  password behavior, canonical callbacks, session, and logout passed.
- Verified one new booking-confirmation event through durable claim, Brevo API
  acceptance, provider delivery log, controlled inbox receipt, and truthful
  Admin Email Operations, then removed every controlled Auth/domain fixture.
- Verified the active `hello@mykustomers.com` route with one controlled message;
  Cloudflare recorded it received and delivered/forwarded.

## 2026-08-25 - Booking Completion And Required Business Logo

Status: VERIFIED - PRODUCTION

- Replaced browser-native booking completion confirmation with an accessible
  in-app dialog, in-dialog pending/error states, cancel semantics, and the
  unchanged authoritative `DELIVERED -> COMPLETED` transition. Cancellation now
  follows the same application-owned confirmation policy.
- Required a selected logo before creating a first or additional business, then
  staged the workspace until the existing optimized logo endpoint persists and
  the server verifies `logo_path`. Failed uploads remain resumable without
  creating a second workspace.
- Preserved legacy no-logo businesses, upload/replace/remove behavior, public
  fallback, booking/email/admin boundaries, and the paused provider and Admin
  Phase 6 work. No migration or environment change was introduced.
- Added policy regressions and expanded onboarding, multi-business, booking
  completion, failure recovery, cleanup, and responsive E2E coverage.
- PR #23 passed Quality, Tests, Build, E2E, and Dependency Security and merged
  conflict-free as `9dae103`. Vercel deployed that exact `main` commit. One
  isolated production Auth user verified no-logo rejection without row
  creation, optimized first/additional-business logos, workspace switching,
  the completion dialog Cancel/final action at 320px, feedback guidance, and
  controlled logo replace/remove/restore. Cleanup verified zero temporary Auth
  or business fixtures. Runtime Security remained intentionally skipped by the
  protected-backend safe-target policy; no Docker or gate bypass was used.

## 2026-08-25 - Brevo Transactional Email Adapter

Status: IMPLEMENTED - CONFIGURATION REQUIRED

- Added a server-only Brevo direct transactional adapter with bounded timeout,
  safe provider-error mapping, deterministic provider idempotency, and minimized
  response handling while retaining development/no-network and Resend adapters.
- Made Admin Email Operations derive truthful provider/configuration wording from
  the delivery selection. `SENT` continues to mean provider acceptance only.
- Added unit and static security regressions for provider switching, HTTP/network
  failures, secrets, atomic claiming, domain-state isolation, privacy, logging,
  and absence of marketing/contact synchronization. No migration, dependency,
  infrastructure, webhook, retry control, historical replay, or Admin Phase 6
  work is included.
- Production activation remains blocked on authenticated Brevo account access,
  approved sender/domain authentication, Production-only Vercel values, and one
  controlled new-event/inbox verification.

## 2026-08-25 - Booking Journey UX

Status: VERIFIED - PRODUCTION

- Replaced the ambiguous booking-detail next-step card with one server-derived,
  accessible lifecycle stepper and contextual action area across draft,
  confirmation, fulfilment, completion, feedback, and cancellation states.
- Preserved every transition and capability boundary. Reschedule
  reconfirmation, pending amendments, and pending add-ons provide explicit
  context without becoming fake statuses or blocking valid lifecycle work.
- Clarified Scheduled delivery date, made new total/deposit fields empty, and
  normalized an empty optional deposit to zero while preserving integer
  minor-unit validation and populated edit values.
- Added exhaustive journey/domain and form regressions plus desktop/mobile
  canonical E2E coverage at 320-1440 pixels. No migration, environment change,
  public-route redesign, or Admin Phase 6 work is included.
- PR #21 passed Build, Tests, E2E, Dependency Security, and Quality, then merged
  conflict-free as `b26f0c4`. Vercel deployed that exact `main` commit, and a
  controlled production owner/business/customer/booking verified empty new
  money inputs, Scheduled delivery date, confirmed progress, Start work, Ready,
  Delivered, Complete, feedback guidance, and 320-1440 responsive containment.
  Cleanup verified zero temporary business or Auth-user leftovers. The protected
  configured backend kept runtime fixture suites intentionally skipped by their
  safe-target gate; static security and authenticated lifecycle coverage passed.

## 2026-08-25 - Admin Read-Only Email Operations

Status: VERIFIED - PRODUCTION

- Added `/admin/emails` summary/directory/detail, bounded date/status/event-type
  filters, search, pagination, delivery-configuration truth, health assessment,
  event distribution, and business/booking cross-links.
- Added strict recipient/failure minimization and two active-admin-only read RPC
  definitions plus one private controlled failure classifier. No table, domain
  data, index, direct grant, retry, resend, or outbox mutation is introduced.
- Added unit, static security, gated immutable runtime, and expanded admin E2E
  coverage. The approved production-backed migration applied transactionally;
  direct authorization/minimization/immutability checks and the full 35-pass E2E
  suite pass with zero temporary leftovers.
- PR #19 passed all required checks and merged as `52a1820`. Vercel deployed that
  exact `main` commit, the duplicate push checks passed, and authenticated
  production smoke verified summary/list/detail, search, filters, pagination,
  masking, cross-links, read-only controls, and layout integrity over nine live
  events. Two temporary Auth creation attempts failed before an Auth UUID was
  issued; residue verification found zero matching users and exactly one active
  production `SUPER_ADMIN`, so the existing approved admin session was used for
  the non-mutating smoke.

## 2026-08-25 - Admin Read-Only Booking And Issue Operations

Status: VERIFIED - PRODUCTION

- Added read-only Bookings and Issues directories/details, debounced search,
  lifecycle/status/category/business filters, stable pagination, loading and
  safe not-found states, and business/booking/user cross-links.
- Added strict minimized DTOs and four active-admin-only read RPC definitions.
  Booking detail separates confirmation, amendments, add-ons, material changes,
  status history, cancellation, structured feedback, issues, and grouped email
  states. Private comments, internal notes, contacts on lists, raw terms,
  tokens/hashes, and delivery payloads remain excluded.
- Added unit and static security regressions and expanded admin E2E denial,
  navigation, invalid-route, and responsive coverage.
- The forward migration was explicitly approved and applied transactionally to
  the production-backed Supabase project. Ownership/grants, anonymous denial,
  active-admin real-data reads, exact counts/effective value, safe search/UUIDs,
  session refresh, and four responsive widths pass. No temporary admin or domain
  fixture was created. PR #17 passed all eight checks and merged as `edbef26`;
  Vercel deployed that exact commit, and authenticated production smoke passed
  for all four routes with no browser warning or error diagnostics.

## 2026-08-25 - Admin Read-Only Businesses And Users Directories

Status: VERIFIED - PRODUCTION

- Added active-admin-only Businesses and Users directories and detail routes,
  including server search/pagination, plural owner handling, safe cross-links,
  membership relationships, and aggregate operational support metrics.
- Added four postgres-owned narrow RPC projections. Auth information is limited
  to email, timestamps, confirmation state, provider names, and a target-specific
  platform-admin badge; no raw Auth object, token, session, or identity payload
  is exposed.
- Added strict DTOs, loading/not-found behavior, overview links, exact unit and
  static security contracts, opt-in live fixtures, expanded E2E denial and
  support journeys, current-business independence, and responsive coverage.
- Editing, impersonation, suspension, membership mutation, hard deletion,
  billing, recent operational lists, and Admin Phase 4 remain deferred.
- Applied and DB-linted the RPC migration, reconciled every returned count and
  provider projection against production in read-only transactions, and proved
  ordinary/anonymous denial. A temporary auto-confirmed zero-business admin
  passed the complete desktop/responsive support journey and was removed with
  its test-only authority audit; cleanup restored exactly one active admin.
- PR #15 passed Quality, Tests, Build, Dependency Security, E2E, and Vercel
  checks and merged as `4437a161`. Vercel deployed that exact `main` commit; a
  fresh production-only read-only browser smoke passed overview, both
  directories, search, pagination, details, bidirectional cross-links, refresh,
  logout, authorization redirect, and four responsive widths. Independent
  cleanup found zero temporary Auth users/profiles and one approved active
  production `SUPER_ADMIN`.

## 2026-08-25 - Admin Production Bootstrap And Read-Only Operations

- Verified the production admin foundation with the approved existing Auth
  identity as the sole active `SUPER_ADMIN`; live disable/re-enable checks proved
  next-request revocation, restoration, and expected audit evidence.
- Added an aggregate-only active-admin RPC and server boundary for platform,
  booking, issue, and email-state counts, with no PII, monetary totals, record
  browsing, or mutations.
- Replaced the empty admin landing surface with a responsive operational
  overview, structural loading state, safe unavailable state, and truthful
  database/authorization/outbox status.
- Added exact unit, static security, live runtime-security, cross-business E2E,
  and 390/768/1024/1440 responsive regression coverage. PR #13 passed CI and
  merged as `22e6617`; its Vercel production deployment is current and ready,
  the authenticated overview passed, and runtime logs contained no warning,
  error, or fatal events.

## 2026-08-24 - Platform Admin Authorization Foundation

- Added the dedicated `platform_admins` role/status model, RLS, browser grant
  denial, self-scoped active-admin lookup, and trigger-backed authority audit.
- Added server-only platform authorization helpers and a separate minimal
  `/admin` shell with safe denial and no business-data or destructive controls.
- Added controlled bootstrap, threat model, MFA readiness, future phase rules,
  and platform/vendor authority separation documentation.
- Added unit, static security, live Supabase, E2E, and responsive regression
  coverage. The migration was applied only to the configured development
  database at that point; the 2026-08-25 entry supersedes that historical
  rollout status.
- Isolated the existing canonical E2E browser projects into distinct test-only
  rate-limit identities so parallel confirmation journeys cannot exhaust one
  shared loopback bucket; production rate limits and assertions are unchanged.

## 2026-08-24 - CI E2E Reliability And Failure Diagnostics

Status: IMPLEMENTED - REMOTE VERIFICATION PENDING

- Audited GitHub Actions run #22 and traced its only failure to the mobile
  multi-business forged-switch test. The test changed a hidden input and clicked
  in separate browser tasks, allowing React hydration to restore the authorized
  business ID before submission; the application correctly switched to that
  submitted business and redirected to `/dashboard`.
- Reproduced the exact failure locally once in five sequential CI-equivalent
  repetitions. The forged value and `requestSubmit` now execute in one browser
  task, preserving the strict unauthorized-selection assertion without changing
  the application action, membership authority, RLS, or tenant behavior.
- Added GitHub and JSON Playwright reporters plus a tested post-failure sanitizer.
  CI uploads only redacted report/error-context text for seven days and excludes
  raw traces, media, environment files, and browser storage because E2E journeys
  traverse customer capability URLs.
- Updated official checkout, setup-node, and upload-artifact actions to their
  current v7 majors, removing the action-runtime deprecation warning from the
  failed run. Runtime Security remains independently protected by its existing
  enable variable and environment.
- The fixed mobile journey passed ten consecutive CI-equivalent repetitions.
  Full local and remote pipeline verification follows before this entry becomes
  VERIFIED.

## 2026-08-24 - Navigation Latency And PWA Performance Deep Audit

Status: VERIFIED - PRODUCTION

- Reproduced authenticated production navigation latency with controlled
  three-run browser profiles and separated local production-build evidence from
  Vercel production evidence.
- Identified a Dublin-to-Washington Vercel request path while Supabase executes
  in London, then configured the Vercel function region as `lhr1`.
- Collapsed current-business membership/identity, booking/customer, and
  feedback/booking reads through existing RLS-protected foreign-key relations,
  removing avoidable sequential Supabase HTTP round trips.
- Streamed only secondary monthly dashboard analytics while preserving primary
  operational content, exact metrics, request-scoped memoization, dynamic tenant
  freshness, and all authorization boundaries.
- Confirmed semantic Link navigation, effectively instant browser Back, no
  service worker/private RSC cache, and no meaningful client-bundle regression.
  Rejected Redis, broad prefetch, Edge conversion, speculative indexes, and
  persistent tenant caching.
- Added focused performance-policy regression coverage. No schema migration,
  dependency, client JavaScript behavior, environment variable, or secret
  change was introduced.
- Local gates passed lint, strict typecheck, 201 ordinary tests, 14 live
  runtime-security tests, 34 desktop/mobile Playwright journeys with 6
  intentional skips, production build, moderate dependency audit, and
  `git diff --check`.
- Pull request #10 passed all required CI without conflicts and merged as
  `e3c6e5b`. Vercel promoted the matching Production deployment, and response
  headers confirmed execution moved from `iad1` to `lhr1`.
- Production medians improved by 43-79% across login, all seven core
  transitions, and business switching. Mobile LCP improved from 2.50 seconds to
  1.41 seconds; desktop LCP was effectively flat. Browser and real standalone
  app-window checks retained zero CLS, no service-worker control, and no
  horizontal overflow.

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
