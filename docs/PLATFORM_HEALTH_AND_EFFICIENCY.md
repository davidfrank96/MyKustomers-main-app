# Platform health and efficiency — 2026-09-19

STATUS: IMPLEMENTED — RELEASE VERIFICATION PENDING

This is a bounded pre-integration audit and two application fixes, not an
exhaustive penetration test or a production load test. NO WHATSAPP INTEGRATION
INCLUDED. Release evidence below distinguishes fixture, cloud-backed, and live
Production observations. No database, environment, provider, or dependency change.

> Platform efficiency work must be evidence-driven. Optimization must not weaken
> tenant isolation, Auth, capability privacy, durable communication evidence, or
> correctness.

## A. Starting repository / Production state

Fresh `chore/platform-efficiency-health` worktree from `origin/main`
`d2fc05ba31caadd07ae5f87676d05ab49dcd2c20` (merged PR #87). Original
`booking-currency-money-pwa` checkout at `9498e925bcd8e1717fdb15ddbd1298da6655582a`
and draft PR #86 were preserved. Starting working trees were clean. Baseline
Production deployment `dpl_ARkFtzA8vE7HQzBMqHHLaXSFgkpg` was READY at that main SHA.
Main CI run `35344826211` succeeded; guarded Runtime Security was skipped.

## B. Admin sign-out starting state

NOT FOUND in `app/admin/layout.tsx`. Identity, role badge, vendor workspace link,
and horizontally scrollable navigation existed without a logout control.

## C. Existing authoritative logout implementation

`components/notifications/logout-form.tsx` calls the existing
`features/auth/actions.ts:logoutAction`. Browser push unsubscribe and badge cleanup
are best effort. Server device revocation remains authoritative; its failure
redirects to the existing recoverable logout error. Supabase sign-out, audit,
business-selection/pending-onboarding cookie cleanup, and `/login?message=signed-out`
remain unchanged. Logout does not require vendor membership.

Existing Supabase default sign-out scope is global. Refresh sessions are revoked;
already-issued access JWTs are not claimed to become instantly invalid everywhere.
Tests assert removal of the browser session and denial of subsequent protected
navigation, not instantaneous revocation of every separately held access token.

## D. Admin logout implementation

Reuse `LogoutForm` in the existing Admin header, outside the scrolling navigation.
At narrow widths it occupies its own discoverable row; at extra-large widths it
orders after navigation. No second logout action or Auth client was introduced.

## E. Admin security regression

Active platform role checks, independent vendor membership rules, `SUPER_ADMIN`,
server verification and privileged AAL2 requirements are unchanged. The browser
fixture verifies a zero-business admin can log out, the selected-business cookie
is cleared, `/admin` and child routes return to login, browser Back reveals no
Admin navigation, and an ordinary vendor is denied. Guarded real-admin coverage
was extended without bypassing its dedicated-test-project guard.

## F. Platform route inventory

| Area            | Routes / implementation reviewed                                                                                                            | Evidence boundary                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Public/Auth     | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/logout`                                                | Source, unit and browser journeys; live Google consent/inbox not exercised |
| Vendor          | `/dashboard`, `/bookings`, `/bookings/new`, `/bookings/[bookingId]`, `/customers`, `/customers/new`, `/customers/[customerId]`, `/insights` | Data loaders, pagination, shared Auth, existing cloud-backed E2E           |
| Profile/account | `/business`, `/business/edit`, `/business/new`, `/settings`, `/onboarding`                                                                  | Production-build fixture browser flows and existing E2E                    |
| Notifications   | `/notifications`, `/notifications/open/[notificationId]`, read/preferences/subscription APIs                                                | Browser contracts, disposable PostgreSQL, worker source/live logs          |
| Capabilities    | `/c/[token]`, `/f/[token]`, `/a/[token]`, `/x/[token]`, open APIs                                                                           | Capability/tenant tests, fixture browser and crawler checks                |
| Public branding | `/social/*`, `/brand/business/[businessId]/logo.png`, logo API                                                                              | Business-owned projection, cache/privacy contracts and image rendering     |
| Admin           | Overview, Businesses, Users, Bookings, Issues, Email Operations, Security & Health, detail routes                                           | RPC bounds, privilege boundaries, presentation tests; live logout pending  |
| Background      | Notification worker/cron, `public/sw.js`, email outbox, Brevo webhook, Resend standby, Auth refresh, Sentry                                 | Source/contracts plus bounded live observations described below            |

## G. Performance baseline

Optimized local Next builds, Chromium, synthetic loopback Auth/REST fixtures,
fresh browser context per route, navigation timing and encoded script resource
sizes. Raw local evidence is in `output/playwright/platform-health/` (ignored,
not uploaded). Backend request counters include prefetch/background activity;
they are not precise per-render SQL counts. No production p95, real query
execution timing or statistically reliable CLS claim is made.

| Valid fixture route  | Baseline TTFB ms | Warm after TTFB ms | Encoded JS before → after bytes |
| -------------------- | ---------------: | -----------------: | ------------------------------: |
| `/`                  |               94 |                235 |                 252255 → 252244 |
| `/login`             |               65 |                 18 |                 267709 → 267698 |
| `/dashboard`         |               22 |                 14 |                 295425 → 295414 |
| `/bookings/new`      |               12 |                  9 |                 311002 → 310991 |
| `/customers`         |               10 |                  8 |                 302075 → 302064 |
| `/business`          |                9 |                  9 |                 296172 → 296161 |
| `/settings`          |               11 |                  7 |                 303838 → 303757 |
| `/notifications`     |               10 |                  8 |                 297190 → 297179 |
| `/admin`             |               14 |                  7 |                 297553 → 301545 |
| Confirmation fixture |               14 |                 10 |                 279869 → 279858 |

Single samples varied under concurrent local tests (initial after homepage 963ms,
then 235ms); these do not establish a latency improvement or a patch-attributable
regression. Homepage implementation is unchanged. Admin adds approximately 4KB
encoded client resources for the existing logout behavior; other measured
successful routes have effectively unchanged client bytes.

The fixture does not implement successful Bookings/Insights data contracts,
booking detail, or Admin Business/Email RPC projections. Those measured error or
empty states are explicitly excluded from route-performance conclusions. Real
journeys and live smoke are separate gates; an error-page timing is not a
successful-route measurement.

## H. Slowest representative routes

Cold homepage/startup was the slowest local sample. New booking had the largest
client resource total among successful measured vendor pages (~311KB). Neither
is a demonstrated new bottleneck. Real Admin aggregates and complete historical
booking pages need production tracing/load evidence before optimization.

## I. Server/data-fetch findings

Request-scoped React caching preserves verified identity/membership deduplication
in `lib/auth/server.ts`; no identity is cached across requests. Independent
workspace reads, dashboard counts/stats, and booking-detail secondary data
already use parallel work or streaming. Bookings/Customers loading boundaries
remain. No speculative waterfall rewrite was justified.

## J. Database/query findings

P2 fixed: customer-detail booking-state detection fetched an unbounded history.
A deterministic 1000-completed-plus-one-active case reproduced a false inactive
result at the REST row cap. Two tenant/customer-scoped, parallel `limit(1)`
existence reads now return at most two IDs. Errors remain conservative. This
trades one history request for two small independent requests. Existing mutation
RPCs remain the authoritative archive/delete protection.

Read-only live aggregate during testing: 40 customer/business groups with bookings,
maximum history 11, zero groups at 1000. This is a latent scale/correctness defect,
not evidence of a current Production outage; controlled E2E fixtures were active.

Main lists use bounded pagination/keyset access. Booking list customer joins avoid
per-row fetches. Customer-list booking-existence enrichment still reads all
matching booking IDs across one customer page; it can hit a REST cap at scale.
This remains a P2 candidate requiring an embedded bounded relation/RPC design and
real API validation. Per-booking historical detail arrays and Admin membership
arrays also warrant volume measurements; blindly truncating them would change
visible history. No N+1 rewrite or index was applied.

Live Performance Advisor: 0 errors, 0 warnings, 26 informational recommendations,
including foreign-key index coverage. No EXPLAIN evidence demonstrated a current
bottleneck; index proposals need exact plans, write/storage costs, rollback and
separate approval.

## K. Client-performance findings

Server route boundaries remain intact; the reused logout component is the only
new client boundary in the Admin header. No new listeners, polling loop, mirrored
state, cache, or dependency. Existing visibility/resume and notification contracts
remain covered. No proven render-loop defect found in the reviewed shared paths.

## L. Bundle findings

Admin resources increase by 3992 encoded bytes in the measured build. Other
successful measured routes change by at most 81 bytes. No dependency duplication
or large new import was introduced. Transfer observations are not webpack
module-attribution or a permanent bundle budget.

## M. Auth/session findings

Auth identity remains server-verified; membership errors do not mean zero
businesses. Zero-business onboarding and separate Admin routing are preserved.
Recovery/OAuth callback validation and shared logout remain authoritative.
Native 24-hour session duration remains the previously accepted Free-plan
limitation: timebox/inactivity are unlimited, access JWT lifetime 3600s, refresh
replay protection enabled with 10s reuse interval. No setting was changed. The
user explicitly deferred the Pro-only session limit; it is not this pass's blocker.

## N. Tenant-isolation findings

Customer-state reads retain both business and customer predicates and underlying
RLS. Public projections derive ownership from durable capability records, not
current-business cookies. Notification PostgreSQL contracts exercise tenant/read/
subscription isolation; existing unit/static/E2E tests cover vendor boundaries.
Guarded runtime tests remain SKIPPED, so no claim of a new full live RLS audit.

Security Advisor showed 0 errors, 46 warnings, 11 informational items. Warnings
include intended SECURITY DEFINER RPC exposure and two private invoker triggers
without explicit search paths. Read-only definitions show those triggers only
set `updated_at` or reject changed `business_id`; `public.rls_auto_enable` returns
`event_trigger`, pins `pg_catalog`, and enables RLS on public DDL-created tables.
These flags alone do not demonstrate exploitable public RPCs. No blanket grants
or revokes were applied. Further grant/search-path hardening is a reviewed
migration follow-up, not a claim that every advisor entry was exhaustively cleared.

## O. PWA findings

`public/sw.js` remains push-focused with no fetch handler/private response cache.
Activation uses existing update behavior. Notification click resolves same-origin
records and opens a window rather than replacing a dirty editor. Auth/capability
HTML and PII are not newly cached. Automated existing-worker, resume, viewport,
resolver and public privacy checks pass. Physical installed-app/OS delivery is
not substituted by browser emulation; no reinstall requirement was introduced.

## P. Notification findings

Durable in-app events are separate from best-effort push. Bounded workers retain
lease/idempotency/attempt limits, 8s send timeout, 35s budget, four batches of two,
invalid-subscription cleanup and terminal ambiguous outcomes. Read retention is
72 hours after first read; unread records are retained. DB contracts cover
concurrent claims and tenant boundaries. Queue-age/capacity evidence is needed
before adding another messaging workload.

## Q. Scheduler result

ACTIVE. Read-only `cron.job` returned `myk-notifications`, `* * * * *`, `active=true`.
Fifteen matching worker-completed logs over a bounded 15-minute sample confirmed
execution with zero queued work/unknown outcomes in that sample. No cron command,
secret, schedule, or activation setting was changed.

## R. Email/outbox findings

Durable events and provider attempts remain separate; provider acceptance is not
delivery. Claim/retry logic pins provider and recipient/event ownership. Ambiguous
outcomes are not blindly retried. Brevo remains primary; Resend remains standby.
Webhook authentication, byte/schema bounds, durable correlation/deduplication and
redacted logging remain intact. Development email was forced for controlled E2E;
no unnecessary real customer email was requested.

## S. Admin performance findings

Overview consumes an aggregate RPC, directories are bounded (20-row pages), and
email attempts/status evidence are batched. Active-admin authorization is shared,
not repeated per table row. Global count costs and tenant detail membership
arrays need cardinality/query plans before index or aggregation changes.

## T. UI/responsive findings

Admin logout is checked at 320, 360, 375, 390, 414, 430, 768, 1024, 1280 and 1440
pixels in Chromium/WebKit, outside the scrolling nav and without document
overflow. Existing Profile/Social and notification shell/overlay checks cover
high-use mobile layouts. No global overflow-hiding workaround or redesign.

## U. Runtime/console findings

Focused Admin pages report no page errors. Existing dev E2E output includes
Next `destination stream closed early` during navigations, image-LCP guidance,
and NO_COLOR/FORCE_COLOR diagnostics. Failed E2E assertions remain failures until
investigated; diagnostics are not suppressed or automatically blamed for them.

## V. Vercel findings

Baseline exact Production deployment had zero matching error, warning and fatal
records in a bounded one-hour log query. This is a sample, not an all-time health
guarantee. Post-release exact-deployment logs are a separate pending gate.

## W. Sentry

NOT VERIFIED. Source redaction was reviewed; no authenticated live Sentry issue/
release access was available. Vercel logs are not Sentry evidence.

## X. P0 findings

No confirmed P0 in reviewed evidence. This does not certify absence of defects
outside the bounded audit.

## Y. P1 findings

No confirmed application P1 identified. Full E2E failures are under investigation
and block the release gate until resolved or independently reproduced/classified.

## Z. P2 fixes made

1. Missing Admin logout: existing shared flow exposed accessibly.
2. Customer-detail history-cap false state/unbounded transfer: bounded parallel
   existence reads, conservative failures, regression reproduction.

## AA. P3 recommendations

Measure large booking histories/Admin aggregates before pagination/index changes;
move existing cloud-backed CI credentials to a dedicated test project; preserve
current protected runtime guards; establish production route/queue-age SLOs and
bundle budgets; review advisor grants/search paths as a separate migration;
complete physical-device, OAuth provider and controlled-inbox acceptance.
Customer-list enrichment is the unresolved P2 scale candidate documented in J.

## AB. Before/after performance evidence

The cap fixture fails on baseline and passes after the change; returned history
rows drop from up to 1000 to at most two. Client sizes and timing caveats are in G.
No claim of production database speedup or real Admin RPC latency is made.

## AC. Database changes

NONE. Disposable local PostgreSQL tests do not apply Production migrations.

## AD. Environment changes

NONE to persisted local/Preview/Production configuration. Test processes use
loopback fixtures or existing E2E credentials with development email.

## AE. Provider changes

NONE.

## AF. Dependencies

NONE added, removed, or upgraded.

## AG. WhatsApp current event-source map

| Existing source                                     | Durable anchor                                     | Future channel consideration (proposal only)                                      |
| --------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Booking confirmation requested / customer confirmed | Booking, confirmation link, email event            | Approved recipient/contact snapshot, secure capability, one logical intent        |
| Amendment requested / confirmed                     | Amendment, parent booking, confirmation link/event | Version and supersession must prevent stale requests                              |
| Add-on requested / confirmed                        | Add-on, parent booking, confirmation link/event    | Independent add-on identity and parent currency/status                            |
| Reschedule / cancellation                           | Booking change/status history, email event         | Authoritative state/change identity; suppress obsolete delivery                   |
| Delivered / feedback invitation                     | Delivery state, feedback capability, email event   | Private link, recipient consent, expiry; manual sharing is not auto-send evidence |
| Feedback received / overdue vendor activity         | Feedback/issue or durable notification source      | Separate vendor recipient/preferences from customer messaging                     |

## AH. WhatsApp provider-boundary recommendation

Current email outbox is deliberately email-specific; push is a separate durable
notification worker. There is no generic communication bus to pretend is already
implemented. A future channel should consume authoritative domain events through
its own delivery ledger/adapter with transactional intent creation. Reuse proven
patterns, not email tables or a current-business browser cookie. No architecture
or product scope is committed by this recommendation.

## AI. WhatsApp idempotency readiness

PARTIALLY READY. Stable business/booking/change/capability/event IDs exist. Future
channel/recipient identity, unique intent constraint, attempt correlation and
receipt state ordering still require design and approved migrations.

## AJ. WhatsApp webhook readiness

PARTIALLY READY. Reuse the Brevo route's authenticate-before-processing, bounded
bytes/schema, durable dedupe/correlation, minimal logs and fail-closed patterns.
A future provider's exact signature/challenge/replay contract is different and
must be implemented/tested explicitly; no WhatsApp route exists in this pass.

## AK. WhatsApp security readiness

Tenant/event/recipient ownership can be resolved server-side from durable records.
Credentials must be SERVER ONLY; never NEXT_PUBLIC, client bundles, logs, Sentry
or browser storage. Consent, verified E.164 recipient ownership, template/locale
rules, opt-out, capability privacy and operator authorization remain prerequisites.
No new credential, grant, SDK, table, infrastructure or message was added.

## AL. WhatsApp rate-limit readiness

PARTIALLY READY. Existing distributed database-backed HMAC-keyed rate limits can
supply primitives without process-local counters. Outbound provider/business/
recipient quotas, inbound abuse limits and queue capacity are not implemented
for WhatsApp. No Redis or new queue was introduced on speculation.

## AM. WhatsApp prerequisites

Choose and approve provider/account ownership and product scope; establish consent
and recipient identity; approve templates/locales; design transactional channel
intent/idempotency and ordered receipts; define bounded retry/unknown outcomes,
quotas, retention, audit and explicit fallback policy; provision server secrets;
prove webhook authenticity and tenant isolation in a dedicated test environment;
load-test capacity and provide operator recovery. Complete this release's gates
before starting that separately authorized integration.

## AN. Files changed

Application: Admin layout and customer query module. Tests: shared logout, Admin
presentations, bounded customer-state unit coverage, fixture Admin session/metrics,
Admin browser and guarded runtime journey. Documentation: this report, changelog,
testing, release checklist, security invariant, and affected feature READMEs.

## AO. Tests added/updated

Permanent tests cover cleanup ordering/failure tolerance; correct tenant/customer
filters and bounded rows including the 1000-row cap; Admin layout placement;
zero-business Admin logout/session-cookie removal/protected revisit/Back; ordinary
vendor denial and ten widths in both engines. Guarded real-admin expectations now
match current post-login routing and include logout; guards remain unchanged.

## AP. Lint

PASS, including the final implementation/documentation rerun.

## AQ. Typecheck

PASS.

## AR. Unit/integration

1085 passed, 24 skipped; 171 test files passed, 21 skipped (39.04s). Two Admin
presentation tests initially needed a server-action mock at the existing client
boundary; after correcting that setup the full suite passed.

## AS. Runtime Security

SKIPPED: 21 tests. The protected dedicated-test-project guard was not bypassed.
Command exit zero is not a runtime-security pass.

## AT. E2E

Initial full run: 71 passed, 19 skipped, 12 failed (14.9m). Most failures remained
pending in mobile form submission; one responsive journey waited for a business
editor to load. Unchanged-assertion serial rerun is in progress. Release blocked
until these failures are classified and the required gate passes.

## AU. Profile/Social

49 passed (4.2m), production build, Chromium/WebKit. Final narrow Admin rerun:
4 passed (3.9s), including the real selected-business cookie constant after
correcting a test typo.

## AV. Notification Contracts

PASS: disposable PostgreSQL retention/RLS/idempotency/concurrent-claim contracts;
24 Chromium/WebKit browser checks (57.9s).

## AW. Build

PASS optimized Next production builds. First sandboxed baseline could not reach
the font host; the network-enabled baseline and final Profile build succeeded.

## AX. Dependency audit

PASS: `npm audit --audit-level=moderate`, zero vulnerabilities.

## AY. Diff check

PASS before the initial commit.

## AZ. Admin Sign-Out Gate

ADMIN SIGN-OUT: PASS in the optimized local app with synthetic Auth in both
engines. Controlled Production logout remains pending; no live pass claimed.

## BA. Platform Efficiency Gate

PLATFORM EFFICIENCY: FAIL (release verification incomplete, not a claimed outage).

## BB. WhatsApp Readiness Gate

WHATSAPP INTEGRATION READINESS: READY WITH PREREQUISITES (architectural assessment
only; release and prerequisite work still required).

## BC. PR

Pending.

## BD. CI

Baseline main green; this branch not yet submitted.

## BE. Merge SHA

Not merged.

## BF. Production deployment

Baseline only; this change is not deployed.

## BG. Production admin logout smoke

PENDING controlled signed-in Admin account. User asked to sign in; no new admin
account or privilege elevation was created.

## BH. Production vendor smoke

Post-release authenticated smoke pending.

## BI. Production public/customer smoke

Post-release non-destructive safe-state/header checks pending.

## BJ. Production PWA/scheduler smoke

Baseline scheduler ACTIVE with observed worker execution. Post-release smoke pending.

## BK. Production logs

Baseline bounded sample in V. Post-release review pending.

## BL. Cleanup

Original checkout/draft PR preserved. Tests use controlled disposable fixtures and
normal cleanup; test servers and any failed-run fixture residue must be checked
before completion. Raw browser traces/storage/passwords/capabilities are not PR
artifacts. Production scheduler remains active.

## BM. Remaining blockers before WhatsApp

Complete E2E, exact-head CI/Preview/Production and controlled Admin/logout smoke;
then approve and fulfill the architectural prerequisites in AM. Live Sentry and
physical-device gaps remain explicitly recorded. Pro-only session duration is an
accepted deferred item, not silently represented as implemented.

## BN. Final status

MY KUSTOMERS PLATFORM HEALTH — BLOCKED

This is the in-progress release status. Do not interpret implementation evidence
as completed Production verification or begin WhatsApp integration.
