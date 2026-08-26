# Master Plan

## Governance Status

Documentation uses these status labels strictly:

- PLANNED: Specified direction, not necessarily present in code.
- IMPLEMENTED: Code, configuration, migration, policy, or infrastructure exists.
- VERIFIED: Implementation has been inspected and successfully tested through an appropriate verification method.

Documentation is not implementation evidence. Future work must inspect repository evidence before reporting anything as implemented, and must run or inspect an appropriate verification mechanism before reporting anything as verified.

## Product

My Customers

## Product Vision

My Customers is a mobile-first SaaS platform for small businesses and SMEs that commonly manage customer orders through informal channels such as WhatsApp, Instagram, phone calls, social media, referrals, and direct messages.

It converts informal customer agreements into structured business records.

Businesses can manage customers, bookings/orders, private booking confirmation,
fulfilment, recorded values and balances, private feedback, customer history,
and operational insights. Vendor subscription management remains planned.

Customers generally do not create My Customers accounts. They interact with individual bookings through secure customer-facing links.

The platform does not initially process payment between the vendor and their customer.

## Product Positioning

Primary positioning:

> My Customers helps small businesses turn informal customer conversations into organised business records.

Supporting concept:

> You already sell through WhatsApp, Instagram, phone calls, and direct messages. My Customers helps you keep track of what happens after the customer says yes.

The product should remain deliberately lightweight.

## Non-Negotiable Architecture

- Application: Mobile-first web application / PWA.
- Architecture: Modular monolith.
- Frontend: Next.js 16 App Router, React, TypeScript, Tailwind CSS.
- Backend: Next.js server-side application layer.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Authorization: Server-side authorization plus PostgreSQL RLS.
- Storage: Supabase Storage.
- Validation: Zod.
- Transactional email: provider-neutral server boundary with development,
  Brevo, and Resend adapters. Brevo is configured as Production primary; Resend
  is verified standby with no automatic failover.
- Testing: Vitest and Playwright.
- Deployment: Vercel initially.
- Native mobile: Not V1.

Accepted decisions are recorded in `docs/DECISIONS.md`.

## Current Project Status

- Phase 0 - Product Definition: VERIFIED.
- Phase 1 - Repository Foundation: VERIFIED.
- Phase 1.5 - Project Governance and Planning: VERIFIED.
- Phase 2 - Authentication and Multi-Tenancy Foundation: VERIFIED.
- Phase 3 - Business Onboarding: VERIFIED.
- Phase 4 - Customer Management: VERIFIED.
- Phase 5 - Booking Engine: VERIFIED.
- Phase 6 - Secure Customer Confirmation Links: VERIFIED.
- Phase 7 - Fulfilment and Operational Booking Lifecycle: VERIFIED.
- Phase 8 - Private Feedback and Operational Issues: VERIFIED.
- Phase 9 - Business Insights and Analytics: VERIFIED.
- Phase 9.5 - Product UX, Design, and End-to-End Experience Audit: VERIFIED.
- Phase A - Confirmed Booking Integrity and Cancellation Notification: VERIFIED.
- Phase B - Booking Amendments and Customer Reconfirmation: VERIFIED.
- Phase C - Booking Add-ons and Customer Confirmation: VERIFIED.

The customer contact and booking-confirmation email foundation is VERIFIED.
Secure confirmation now requires a customer-provided email, preserves immutable
contact evidence, conservatively enriches empty customer contact fields, and
creates a durable `BOOKING_CONFIRMED` email event in the confirmation
transaction. Confirmed-booking cancellation creates one durable
`BOOKING_CANCELLED` event in the same cancellation transaction, preferring the
immutable confirmation contact over current customer email. Development-safe
delivery and all current lifecycle email workflows are implemented. The Brevo
Production adapter, sender/domain, and Vercel values are configured. A controlled
post-deploy booking confirmation passed provider acceptance, delivery-log,
inbox, and Admin Operations verification. Resend is configured standby only.

Inline customer creation during booking is VERIFIED. Every booking still
belongs to exactly one tenant-owned customer, but a vendor may select an active
customer or create a minimal name/email/phone customer inline. Both modes use
one authenticated database transaction for booking creation; the new-customer
mode also creates the customer and both audit events atomically.

The 2026-08-20 pre-redesign engineering quality review is VERIFIED. It
consolidated repeated auth, query, token, and runtime-test infrastructure and
reduced unnecessary reads without changing the accepted architecture, data
model, security invariants, dependencies, product behavior, or phase history.

The 2026-08-21 responsive alignment and documentation governance maintenance
pass stabilizes the current interface across the documented 320-1440px matrix
without starting the broad redesign. Documentation is now an explicit same-task
definition-of-done requirement with a change matrix, migration ledger, and
lightweight drift tests.

The 2026-08-21 main-branch reconciliation and CI quality gate is VERIFIED. The
authoritative product branch has been reconciled with
the older Phase 9.5 UI-pass history without dropping current migrations or
security behavior. GitHub Actions defines the core merge checks, pull request #2
passed them, and GitHub reported the branch cleanly mergeable. Protected live
Runtime Security remains a documented configuration follow-up.

The 2026-08-21 mobile account, business identity, and dashboard navigation pass
is VERIFIED cross-phase maintenance. It adds no billing or broad redesign.
Mobile Settings/logout uses the authenticated shell and existing auth action;
owners can store a normalized website and one bounded WebP logo; public
confirmation shows only safe public identity; and existing dashboard metrics
link to supported destinations. Both business-identity migrations are applied
to development and all ten live runtime security suites pass.

The 2026-08-24 feedback-sharing, loading, and performance maintenance pass is
VERIFIED. It extends the private
feedback capability through the established trusted-sharing boundary, adds
truthful first-open/share evidence, adds structural route loading and stale-
workspace protection during tenant switching, and deduplicates authentication
and business resolution only within one server request. It adds no public review,
customer account, persistent tenant cache, Redis, speculative index, or broad
redesign. Measurement and cache governance are recorded in
`docs/PERFORMANCE.md`.

Phase 1 established a Next.js application foundation, strict TypeScript, responsive shells, design primitives, environment configuration, Supabase client/server boundaries, test infrastructure, PWA foundation, documentation foundation, and lint/build/typecheck/test verification.

## Planned Functionality

The following remain PLANNED and must not be described as implemented until repository evidence exists:

- Subscriptions.
- Staff accounts.
- Booking-ready, progress, completion, feedback, and other lifecycle email
  workflows beyond verified booking-confirmed, booking-cancelled, and amendment
  request/confirmation events.
- Payment provider abstraction for vendor subscriptions.

Implemented in Phase 2 and runtime verified against the configured development
Supabase database:

- Profiles, businesses, business memberships, and audit log migration.
- Initial RLS policies, grants, helper functions, and tenant isolation behavior.
- Cross-tenant select/mutation denial, membership escalation denial, owner/member
  authorization, profile isolation, anonymous denial, and audit write boundaries.

Phase 2 email verification completed on 2026-08-25 using Brevo custom SMTP for
Supabase Auth. A controlled signup reached the inbox and confirmed into an
authenticated zero-business session. Recovery reached the canonical callback,
updated the password, rejected the old password, accepted the new password, and
logged out cleanly. The earlier default-sender rate-limit limitation is closed.

Implemented and verified in Phase 3:

- Authenticated no-business users are routed into business onboarding.
- Business creation stores name, slug, category, description, contact details,
  address text, and onboarding completion timestamp.
- Business creation and owner membership creation are atomic through a narrow
  authenticated Supabase RPC that derives ownership from `auth.uid()`.
- Current-business resolution uses active memberships as the source of truth.
- Owners can edit the current business profile at `/business`; members cannot
  perform owner-only updates.
- Runtime Supabase tests verify unauthenticated creation denial, duplicate slug
  handling, atomic rollback on invalid input, owner/member authorization, and
  cross-tenant mutation denial.

Implemented and verified in Phase 4:

- Businesses can view, create, edit, search, paginate, open, and archive
  tenant-owned customer records.
- Customer records belong to exactly one business through `customers.business_id`
  and are not Supabase Auth users or business members.
- Customer table RLS allows active business members to read, create, and update
  only customers owned by businesses where they hold active membership.
- Customer business ownership is immutable in Phase 4; ordinary UI deletion is
  archiving through `archived_at`.
- Runtime Supabase tests verify customer tenant matrix, anonymous denial,
  unauthorized create denial, cross-tenant mutation denial, member permissions,
  archived-record protection, and search isolation.

Implemented and verified in Phase 5:

- Businesses can create, list, search, filter, view, edit, and manage
  tenant-owned bookings connected to active tenant-owned customers.
- Bookings store a database-generated immutable human-readable reference,
  explicit currency, integer minor-unit total and deposit values, derived
  balance display, optional scheduled date/time, private internal notes, and
  lifecycle status.
- Booking `business_id`, `customer_id`, `reference`, and `created_by` are
  immutable after creation. Phase 5 keeps customer reassignment out of scope to
  avoid weakening the business/customer invariant.
- Booking lifecycle transitions now route customer confirmation through Phase 6:
  `DRAFT -> AWAITING_CUSTOMER or CANCELLED`, customer confirmation via a valid
  scoped link records `AWAITING_CUSTOMER -> CONFIRMED -> IN_PROGRESS`
  atomically, then vendor workflow uses `IN_PROGRESS -> READY or CANCELLED`,
  `READY -> DELIVERED`, and `DELIVERED -> COMPLETED`. `COMPLETED` and
  `CANCELLED` are terminal. The `CONFIRMED -> IN_PROGRESS` RPC edge remains for
  legacy rows, but new confirmations require no Start work action.
- Booking status history is recorded by database trigger and authenticated
  browser clients cannot insert or mutate history rows directly.
- Booking items are deferred. Phase 5 tracks booking-level title, description,
  value, deposit, balance, schedule, notes, status, and history without adding a
  catalog or line-item model prematurely.
- Runtime Supabase tests verify booking tenant matrix, unauthorized create
  denial, business/customer reassignment denial, invalid finance denial, valid
  and invalid transitions, terminal locks, history fabrication denial, anonymous
  denial, member permissions, and search isolation.
- New Booking supports explicit existing-customer and inline-new-customer modes.
  The server rejects contradictory payloads, cross-tenant or archived customer
  IDs, and derives the current business and actor rather than accepting either
  as client authority.
- Exact active-customer name, normalized-email, or phone matches produce a
  tenant-scoped, non-blocking warning. The vendor must explicitly use the
  existing customer or continue with a separate customer; no automatic merge
  or reassignment occurs.

Implemented and verified in Phase 6:

- Vendors can generate, regenerate, and revoke customer confirmation links for
  eligible bookings. Raw tokens are shown once in the vendor UI and only SHA-256
  token hashes are stored.
- The one-time generated URL is shared through an editable privacy-safe message
  with native system share, WhatsApp, Telegram, copy-message, and copy-link
  actions. The URL remains application-controlled and no messaging provider is
  integrated.
- Confirmation links are high-entropy opaque capabilities with a default
  24-hour lifetime. Booking references and database IDs are not public
  credentials.
- Public `/c/[token]` pages use server-side token lookup, persistent hashed
  rate-limit buckets, no-store/noindex headers, and minimized booking data.
  Public GET views do not consume links.
- Dynamic confirmation metadata reads only link validity plus public business
  name/logo. It emits canonical Open Graph/Twitter metadata and never receives
  customer, contact, price, schedule, notes, or full booking data.
- Customer confirmation is a POST-backed atomic database operation that marks
  the link used, moves the booking to `CONFIRMED`, stores an immutable terms
  snapshot/hash, writes confirmation evidence, and records audit metadata.
- Expired, revoked, unknown, consumed, and cross-tenant access paths return safe
  outcomes without exposing token hashes, internal notes, audit logs, business
  member data, or tenant IDs.
- Ordinary material changes after customer confirmation are denied at the
  database boundary. The explicit reschedule workflow is the current exception:
  it returns the booking to `AWAITING_CUSTOMER`, clears current confirmation
  fields, revokes open links, and preserves original confirmation evidence.
  Internal notes are non-material and do not invalidate confirmation.

Implemented and verified in Phase A:

- Customer-agreed customer, title, description, currency, total, deposit, and
  schedule fields are locked once confirmed and throughout later lifecycle
  states; crafted direct updates fail in PostgreSQL.
- Material edits while `AWAITING_CUSTOMER` revoke the open confirmation link and
  require a newly generated link. Draft editing remains unchanged.
- Confirmed cancellation requires a bounded plain-text reason, preserves the
  immutable confirmation row/snapshot/hash/contact and status history, and
  atomically creates at most one `BOOKING_CANCELLED` outbox event.
- Cancellation delivery uses confirmation contact first, falls back to current
  customer email only for legacy confirmation evidence without contact, and a
  provider failure never rolls back cancellation.
- Phase C add-ons create linked scope records and do not rewrite the original
  confirmed agreement.

Implemented and verified in Phase B:

- `booking_amendments` stores one active pending structured proposal per booking,
  including immutable old/proposed snapshots and hashes, changed fields, reason,
  frozen confirmation contact, token lifecycle, and effective evidence.
- Proposal does not mutate `bookings`. Customer confirmation uses a service-only,
  purpose-specific, rate-limited 24-hour capability and one atomic transaction to
  verify the base hash, update effective terms, preserve history/audit, consume
  the request, and create one confirmation email event.
- Amendments are limited to `CONFIRMED` and `IN_PROGRESS`; customer reassignment,
  internal notes, `READY`/`DELIVERED`, terminal bookings, add-ons, and negotiation
  are excluded. Vendor revoke, booking cancellation, advancement to `READY`, and
  explicit reschedule deliberately invalidate pending requests.
- The authoritative confirmation contact wins over a conflicting customer email.
  Request and confirmation provider failures affect only outbox state. Analytics
  reads the current effective booking exactly once and does not count amendments
  as bookings.
- Live runtime and desktop/mobile browser tests verify tenant isolation, token
  purpose attacks, one-time races, stale-base denial, cancellation interaction,
  direct-edit regression, safe metadata, and responsive current/proposed diffs.

Implemented and verified in Phase C:

- `booking_addons` stores linked new scope without changing the canonical
  booking or any original/amendment confirmation evidence. V1 add-ons inherit
  the parent currency and current schedule and are limited to `CONFIRMED` and
  `IN_PROGRESS` bookings.
- Draft and awaiting-customer add-ons are proposals only. A separate 24-hour,
  hash-only `booking_addon_confirmation` capability confirms one structured
  snapshot atomically; confirmed add-ons are immutable.
- Only confirmed add-ons contribute to derived current value, deposit, balance,
  recorded/completed value, average value, and deposit analytics. Booking count
  remains based on parent bookings.
- One awaiting add-on is permitted per booking. Pending amendment and add-on
  requests cannot coexist; reschedule, cancellation, and advancement to `READY`
  cancel pending add-ons and revoke their links.
- Request/confirmation email events, safe metadata, trusted sharing, first-open
  tracking, tenant RLS, wrong-purpose denial, race idempotency, failure
  persistence, and responsive customer/vendor journeys are verified.
- Confirmed add-on correction/cancellation, independent add-on delivery,
  catalog/inventory, payment processing, and billing remain deferred.
- Runtime Supabase tests verify token lifecycle, minimization, one-time
  confirmation, revocation, expiration, regeneration, material-change
  invalidation, non-material edit behavior, race behavior, rate limiting, audit
  events, and raw-token non-logging.
- Audits distinguish link creation, vendor share-method selection, first valid
  hydrated open, and customer confirmation. Share selection does not claim
  delivery/read status, and first-open writes are idempotent and service-only.

Implemented and verified in Phase 7:

- Vendors can move customer-confirmed bookings through the operational
  lifecycle: `CONFIRMED -> IN_PROGRESS -> READY -> DELIVERED -> COMPLETED`.
  `CONFIRMED`, `IN_PROGRESS`, and `READY` can be cancelled by an authenticated
  business member; `COMPLETED` and `CANCELLED` remain terminal.
- Operational timestamps are managed by the database on lifecycle transitions:
  `started_at`, `ready_at`, `delivered_at`, `completed_at`, and `cancelled_at`.
  Cancellation can store a bounded reason.
- Direct authenticated browser status writes are blocked. Status changes use
  `public.transition_booking_status`, a narrow authenticated RPC that checks
  tenant membership, locks the booking row, applies the transition graph, and
  writes audit events.
- Rescheduling before work starts uses `public.reschedule_booking`. Confirmed
  reschedules return the booking to `AWAITING_CUSTOMER`, clear current
  confirmation evidence, revoke open confirmation links, and record a
  `booking_changes` row plus audit event. Non-material internal-note edits do
  not invalidate customer confirmation.
- Dashboard and booking list views expose operational queues for due today,
  overdue, in-progress, and ready bookings.
- Runtime Supabase tests verify valid and invalid transitions, cross-tenant RPC
  denial, anonymous denial, customer-token privilege denial, status-history and
  booking-change integrity, stale/repeated transitions, reschedule confirmation
  invalidation, non-material edit regression, cancellation invalidation,
  terminal locks, operational audit events, and due/upcoming behavior.

Implemented and verified in Phase 8:

- Vendors can generate, regenerate, and revoke private feedback links for
  completed bookings that do not already have submitted feedback. Raw feedback
  tokens are shown once and only SHA-256 token hashes are stored.
- Feedback links use a dedicated `booking_feedback` purpose, separate from
  confirmation links, with a default 14-day lifetime, one open link per
  booking, revocation support, and server-only public lookup/submission RPCs.
- Public `/f/[token]` pages use no-store/noindex/no-referrer headers,
  persistent hashed rate-limit buckets, minimized booking context, and safe
  unavailable/submitted states.
- Feedback submission is atomic, one-time, immutable, limited to completed
  bookings, and stores private rating, on-time, expectation, and optional plain
  text comment data for the owning business only.
- Vendors can create and resolve internal operational issues on bookings.
  Issues are tenant-scoped, auditable, non-public, and resolution is terminal.
- Booking detail and customer detail views expose private feedback and issue
  information only to authenticated members of the owning business.
- Runtime Supabase tests verify valid feedback submission, invalid/expired/
  revoked/consumed links, wrong-purpose token attacks, non-completed booking
  denial, tenant feedback visibility, vendor mutation denial, race behavior,
  issue tenant isolation, issue resolution concurrency, audit events, and
  service-role/SECURITY DEFINER boundaries.
- Feedback requests reuse the trusted confirmation-sharing interaction with
  private contextual copy, native share, WhatsApp, Telegram, copy-message, and
  copy-link methods. Share evidence records intent only; crawler-safe metadata
  and post-load idempotent open recording avoid false read claims.

Implemented and verified in Phase 9:

- `/insights` provides authenticated, tenant-private business analytics derived
  from persisted customers, bookings, feedback, and issue records.
- Metric definitions are documented in `docs/ANALYTICS_DEFINITIONS.md` and in
  the application definitions section. Booking status inclusion, returning
  customer logic, date range behavior, on-time calculation, issue metrics, and
  feedback metrics are explicit.
- Value metrics use conservative wording such as recorded booking value and
  completed booking value. They are grouped by currency and never presented as
  revenue, cash received, profit, or cross-currency totals.
- Date ranges support this month, last month, last 30 days, this year, and a
  validated custom range up to five years, with previous equivalent period
  comparison that handles zero denominators safely.
- Aggregates are calculated by `public.get_business_insights`, a narrow
  authenticated Supabase RPC that checks active business membership and returns
  aggregate JSON. No analytics tables, materialized views, public reports,
  exports, billing, AI recommendations, or forecasting were added.
- Runtime Supabase tests verify exact metric correctness, tenant aggregate
  isolation, cross-tenant RPC denial, currency separation, cancelled/draft value
  exclusion, feedback metrics, issue distribution, and on-time behavior.

Implemented and verified in Phase 9.5:

- Product UX audit completed across authentication, onboarding, dashboard,
  customers, bookings, customer confirmation, fulfilment, feedback, operational
  issues, insights, and business profile.
- Authenticated navigation now has a canonical product map: Home, Bookings,
  Customers, Insights, and Business, with active state on desktop and mobile.
- Booking detail now surfaces a state-specific next step near the primary
  booking summary so the owner can identify the current state and likely next
  action quickly.
- Vendor and customer-facing copy avoids internal database/security terminology
  in visible flows, while security documentation and tests keep precise
  technical language.
- Booking money display remains integer minor-unit based and now renders
  Nigerian Naira naturally as `₦45,000` for a `45000` owner-entered amount.
- A canonical Playwright journey covers authenticated business setup, customer
  creation, booking creation, customer confirmation, fulfilment, completion,
  private feedback, internal issue handling, and insights verification.
- Phase 9.5 did not add billing, payment processing, messaging automation,
  exports, staff management, schema changes, or public review functionality.

Implemented and verified as cross-phase multi-business account support:

- One authenticated account may hold multiple active `business_members` rows;
  `profiles` remains identity-only and has no permanent business foreign key.
- A server-read HTTP-only cookie remembers the preferred business ID. Every
  request resolves it against active memberships and deterministically falls
  back to the oldest active membership when it is absent, stale, or revoked.
- A shared responsive header switcher changes workspace through a validated
  server action and reloads `/dashboard`; the five-item mobile navigation is
  unchanged.
- `/business/new` reuses `create_business_onboarding` and makes the returned
  owner workspace current immediately.
- Private operational surfaces use the resolved business. Public `/c`, `/a`,
  `/x`, and `/f` capabilities remain independent of account preference.

Implemented with external redirect configuration blocking full verification as
cross-phase business discoverability and Google authentication support:

- The Business page lists every active membership with business identity,
  owner/member role, a textual current-business indicator, the existing secure
  switch action, and the existing `/business/new` path.
- The header remains the quick switcher and now includes a textual current state;
  mobile navigation remains five items.
- Login and signup share one Supabase `signInWithOAuth` Google action. PKCE code
  exchange remains in `/auth/callback`, and post-auth routing uses the same zero,
  one, and multiple-business resolution as email/password users.
- A short-lived HTTP-only callback preference carries only a sanitized local
  `next` path. It is not a session or authorization source.
- The development project's public Auth settings report Google enabled. A real
  Google-to-Supabase authorization completed through the normal local callback,
  established a Google session, provisioned one profile, routed zero memberships
  to onboarding, persisted after refresh, and logged out cleanly.
- The same controlled Google account created one and then two active business
  memberships, followed normal current-business resolution, switched workspaces,
  and retained its selection after refresh. Required CI passed, the merge deployed
  successfully to Vercel, and production Google OAuth repeated the callback,
  current-business, switching, persistence, logout, and protected-route journey.
  Same-email identity behavior remains a separate lifecycle check. No Vercel
  variable or Google credential is required.

## Platform Admin Roadmap

Admin Phase 0/1 - Platform Admin Architecture and Authorization Foundation:
VERIFIED IN PRODUCTION.

- A dedicated `platform_admins` model authorizes platform access independently
  from vendor tenant roles.
- `/admin` has a separate server-protected shell with no destructive action,
  impersonation, billing, staff management, or generic data browser.
- Browser roles cannot enumerate or mutate admin records; an authenticated
  function returns only the active caller's own record.
- Controlled UUID-based bootstrap and admin authority changes are audited.
- The approved existing Auth identity is the sole active production
  `SUPER_ADMIN`; live disable/re-enable checks proved immediate revocation,
  restoration, and authority-change audit evidence.

Admin Phase 2 - Read-Only Operations Overview: VERIFIED IN PRODUCTION.

- A narrow, active-admin-only database function returns aggregate counts for
  platform scale, booking operations, open issues, and email delivery states.
- The page returns no record rows, identity details, customer PII, or financial
  totals and contains no write operation.
- Exact live fixture deltas, caller denials, disablement, current-business
  independence, and responsive behavior are covered by automated tests.
- PR #13 passed CI and merged as `22e6617`; Vercel marked that exact production
  deployment current and ready, authenticated `/admin` rendered live aggregates,
  and the deployment log view reported zero warning/error/fatal events.

Admin Phase 3 read-only businesses and users is VERIFIED IN PRODUCTION from PR
#15 and merge `4437a161`. Admin Phase 4 read-only bookings and issues is
VERIFIED IN PRODUCTION from PR #17 and merge `edbef26`. Its forward RPC migration
was explicitly approved and applied to the configured production-backed
Supabase project. The migration, grants, direct anonymous denial, authenticated
local UI against live data, all eight PR checks, exact Vercel deployment, and
four-route production smoke pass.
Phase 5 email
operations, Phase 6 reviewed safe writes, and Phase 7 security/system health
remain planned. Each phase requires its own threat-model and regression update.

Admin Phase 4 keeps the existing authorization boundary and adds global,
server-paginated booking and issue operations. Booking value means current
canonical booking value plus confirmed add-ons only. Directories are minimized;
detail evidence is allowlisted and never returns raw tokens/hashes, internal
notes, feedback comments, or email delivery payloads. No admin write exists.

Admin Phase 5 email operations is verified in production from PR #19 and merge
`52a1820`. Its read-only RPC migration is applied to the production-backed
project, runtime verified, deployed by Vercel from that exact commit, and
authenticated production smoke verified the minimized live routes.
`/admin/emails` provides a bounded platform-wide summary, event distribution,
search, filters, stable pagination, business/booking links, and safe event
detail. It never returns message content, full recipients, provider identifiers,
raw failures, or provider configuration. Production selects Brevo, and a new
controlled event passed provider acceptance, inbox receipt, and Admin listing.
The historical pending event was never claimed, has zero attempts,
targets the reserved `example.com` domain, and will not be replayed. There is no
retry scheduler.

Admin Phase 6A - MFA And Privileged-Action Security Framework: VERIFIED -
PRODUCTION.

- Native Supabase TOTP enrollment and challenge are available only to active
  platform admins at `/admin/security`.
- Existing read-only pages continue to require an `ACTIVE SUPER_ADMIN`; future
  writes additionally require signature-verified AAL2 through one central
  server helper.
- Ordinary or owner AAL2 users, disabled admins, active AAL1 admins, and forged
  client flags fail closed under the tested authorization matrix.
- Reusable explicit confirmation, bounded optional reason, allowlisted audit
  evidence, and sole-admin recovery rules are defined without adding a mutation.
- Controlled temporary-admin TOTP runtime verification, cleanup, PR #27 CI,
  conflict-free merge `b90ab5f`, Vercel Production deployment, and authenticated
  production security/read/responsive smoke passed. The approved production
  admin was not modified.
- Admin Phase 6B implements one MFA-gated write on email-event detail: retry a
  `FAILED` event only when the centralized policy proves a non-accepted
  transient failure. The server and atomic claim recheck status, attempt,
  provider, failure evidence, current admin authority, and the required reason.
- Prior attempts remain immutable evidence. Retry stays on the original provider
  with an attempt-scoped idempotency key; ambiguous outcomes, `SENT`, `PENDING`,
  `SENDING`, invalid recipient/sender/configuration, and secure-link request
  events are denied.
- There is no scheduler, automatic failover, bulk/force retry, recipient/content
  editing, suspension, deletion, membership mutation, or impersonation.

Admin Phase 7 system health remains planned and is not started.

Customer communication detour: implemented pending production verification.
The vendor booking page now refreshes from a current-business-scoped minimal
snapshot after customer confirmation or feedback. Confirmed reschedules create a
replacement confirmation capability and `BOOKING_RESCHEDULED` event atomically;
delivery creates one `BOOKING_DELIVERED` event atomically. Provider selection,
outbox claiming, Admin Phase 6B status, and all deferred Admin Phase 7 scope are
unchanged. PWA push remains assessment-only because no service worker, push
subscription model, permission UX, or revocation contract exists.

## Booking Journey UX Maintenance

The vendor booking-detail experience derives one typed journey model from the
authoritative booking status and existing confirmation, amendment, add-on, and
feedback summaries. Persisted enum names and database transitions do not change.
The permanent UX invariant is: every non-terminal booking state must clearly
communicate its current lifecycle position and either the next valid vendor
action or why the booking is waiting.

Customer confirmation records immutable approval evidence and, for new
confirmations, atomically activates the operational `IN_PROGRESS` state. The
normal journey has no Start work action. Delivered bookings enter a payment and
completion checkpoint: append-only vendor-recorded receipts must reconcile the
effective total before completion. Feedback remains a derived post-completion
journey step and is not a booking status.

The payment-reconciliation detour was production verified on 2026-08-26. PR #31
passed every required CI check, merged conflict-free as `c497d2e`, and Vercel
deployed that exact `main` commit. Controlled desktop and mobile production
journeys passed confirmation auto-activation, no Start work action, partial and
final payment recording, completion blocking, completion, and feedback. Real
Brevo acceptance was observed without replaying historical events, and cleanup
confirmed zero controlled booking or Auth fixtures remained. No Docker or
environment change was used.

The earlier booking-journey UX maintenance was production verified on
2026-08-25 after PR #21 passed required CI
and merged conflict-free as `b26f0c4`. Vercel deployed that exact `main` commit;
a controlled production fixture passed form clarity, confirmed-to-completed
lifecycle actions, feedback guidance, and the 320-1440 responsive matrix before
cleanup confirmed zero temporary Auth-user or business leftovers. No migration,
environment change, Docker stack, public-route redesign, or Admin Phase 6 work
was introduced.

## Booking Completion And New-Business Branding Maintenance

Lifecycle-critical confirmations must use accessible application-owned
confirmation UI rather than browser-native confirm/alert/prompt dialogs. The
booking completion action keeps the authoritative database transition but
requires an in-app dialog, blocks duplicate submission, and returns failures
inside the dialog.

Every newly created business must complete a valid optimized business-logo
upload before business setup is considered complete. Existing legacy businesses
remain supported. First and additional business creation stage the atomic
business/membership result, persist the logo through the existing owner/RLS
upload boundary, verify `logo_path`, and only then select the workspace. The
existing onboarding-completion field records a durable pending state until that
verification; a short-lived HTTP-only marker preserves the same-browser route.
Pending workspaces are excluded from current-business resolution and switching,
so failures remain resumable without repeat creation. No schema, lifecycle,
email, environment, or Admin Phase 6 change is included.

Production verification completed on 2026-08-25 after PR #23 passed required
CI and merged conflict-free as `9dae103`. Vercel deployed that exact `main`
commit. A controlled production fixture passed first/additional-business logo
enforcement and optimized persistence, current-business switching, the
application-owned completion dialog Cancel/final paths at 320px, feedback
handoff, and logo replace/remove/restore. Cleanup confirmed zero temporary Auth
or business leftovers. The paused transactional-email branch remains preserved;
no migration, environment change, Docker stack, or Admin Phase 6 work occurred.
