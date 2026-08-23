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
- Transactional email: provider-neutral server boundary with a no-network
  development adapter and optional Resend adapter.
- Testing: Vitest and Playwright.
- Deployment: Vercel initially.
- Native mobile: Not V1.

Accepted decisions are recorded in `docs/DECISIONS.md`.

## Current Project Status

- Phase 0 - Product Definition: VERIFIED.
- Phase 1 - Repository Foundation: VERIFIED.
- Phase 1.5 - Project Governance and Planning: VERIFIED.
- Phase 2 - Authentication and Multi-Tenancy Foundation: IMPLEMENTED - VERIFICATION PENDING.
- Phase 3 - Business Onboarding: VERIFIED.
- Phase 4 - Customer Management: VERIFIED.
- Phase 5 - Booking Engine: VERIFIED.
- Phase 6 - Secure Customer Confirmation Links: VERIFIED.
- Phase 7 - Fulfilment and Operational Booking Lifecycle: VERIFIED.
- Phase 8 - Private Feedback and Operational Issues: VERIFIED.
- Phase 9 - Business Insights and Analytics: VERIFIED.
- Phase 9.5 - Product UX, Design, and End-to-End Experience Audit: VERIFIED.

The customer contact and booking-confirmation email foundation is VERIFIED.
Secure confirmation now requires a customer-provided email, preserves immutable
contact evidence, conservatively enriches empty customer contact fields, and
creates a durable `BOOKING_CONFIRMED` email event in the confirmation
transaction. Development-safe delivery is implemented; production Resend
configuration and broader lifecycle email workflows remain future work.

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

Phase 1 established a Next.js application foundation, strict TypeScript, responsive shells, design primitives, environment configuration, Supabase client/server boundaries, test infrastructure, PWA foundation, documentation foundation, and lint/build/typecheck/test verification.

## Planned Functionality

The following remain PLANNED and must not be described as implemented until repository evidence exists:

- Subscriptions.
- Staff accounts.
- Booking-ready, progress, completion, feedback, and other lifecycle email
  workflows beyond the verified booking-confirmed foundation.
- Payment provider abstraction for vendor subscriptions.

Implemented in Phase 2 and runtime verified against the configured development
Supabase database:

- Profiles, businesses, business memberships, and audit log migration.
- Initial RLS policies, grants, helper functions, and tenant isolation behavior.
- Cross-tenant select/mutation denial, membership escalation denial, owner/member
  authorization, profile isolation, anonymous denial, and audit write boundaries.

Implemented in Phase 2 but still verification-pending overall:

- Public signup E2E is blocked by the configured Supabase project's email rate
  limit during Phase 2V and by the absence of a safe default-email inbox during
  Phase 2E.
- Reset-password completion remains partial until recovery email delivery/token
  handling can be exercised end to end.

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
  scoped link moves `AWAITING_CUSTOMER -> CONFIRMED`, then vendor workflow uses
  `CONFIRMED -> IN_PROGRESS or CANCELLED`, `IN_PROGRESS -> READY or CANCELLED`,
  `READY -> DELIVERED`, and `DELIVERED -> COMPLETED`. `COMPLETED` and
  `CANCELLED` are terminal.
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
- Material changes after customer confirmation invalidate current confirmation,
  return the booking to `AWAITING_CUSTOMER`, clear current confirmation fields,
  and preserve the original confirmation snapshot for already-used links.
  Internal notes are non-material and do not invalidate confirmation.
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
