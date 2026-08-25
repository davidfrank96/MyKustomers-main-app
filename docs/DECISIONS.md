# Architecture Decisions

Accepted ADRs must not be silently rewritten. If a future implementation discovers that an ADR should change, preserve the original decision history, mark it superseded if appropriate, create a new ADR, explain the reason, and identify migration impact.

For significant architecture conflicts, report:

```text
ARCHITECTURE CONFLICT
```

Include the existing accepted decision, conflict discovered, why it matters, recommended alternatives, and impact of each alternative.

## ADR-001 - Modular Monolith

Status: Accepted

Date: 2026-08-18

Context: My Customers is early-stage and does not yet have operational pressure requiring separately deployed services.

Decision: Use a modular monolith rather than microservices.

Rationale: One deployable application keeps development, authorization, data modeling, and deployment simpler while the product is still forming.

Consequences: Module boundaries must be maintained inside the repository. Splitting services later requires a new ADR.

Revisit conditions: Independent scaling, team ownership, data isolation, or deployment cadence creates clear pressure to split a module.

## ADR-002 - Mobile-First Web/PWA

Status: Accepted

Date: 2026-08-18

Context: Primary users are small-business operators who often work from phones.

Decision: Build My Customers as a responsive web application / PWA first. Native mobile applications are not part of V1.

Rationale: A web/PWA approach reaches mobile and desktop users with one codebase and lower release overhead.

Consequences: Responsive behavior, touch targets, and installability matter from early phases.

Revisit conditions: Native platform capabilities become essential to core workflows.

## ADR-003 - PostgreSQL / Supabase

Status: Accepted

Date: 2026-08-18

Context: The product needs relational tenant-owned records, authentication integration, storage, and RLS.

Decision: Use Supabase PostgreSQL as the primary datastore.

Rationale: PostgreSQL fits customers, bookings, memberships, status history, and analytics. Supabase provides managed Postgres plus platform services.

Consequences: Schema changes must be migration-driven and RLS-aware.

Revisit conditions: Supabase cannot satisfy required security, compliance, operational, or scale needs.

## ADR-004 - Supabase Authentication

Status: Accepted

Date: 2026-08-18

Context: Platform users need authentication and session management.

Decision: Use Supabase Auth for authenticated platform users.

Rationale: It integrates with Supabase PostgreSQL and supports the intended Next.js SSR architecture.

Consequences: Authorization must not rely only on authentication. Tenant membership remains a separate application concern.

Revisit conditions: Auth requirements exceed Supabase Auth capabilities.

## ADR-005 - Customer Identity Model

Status: Accepted

Date: 2026-08-18

Context: Business customers are usually people interacting through informal sales channels.

Decision: Customers are business-owned records and do not normally authenticate into My Customers.

Rationale: Customer-facing flows should stay lightweight and link-based.

Consequences: Customer data requires strong tenant controls and scoped public link access.
Phase 4 implements customers as business-owned records in `public.customers`;
it does not create Supabase Auth accounts, passwords, sessions, or
`business_members` rows for customers.

Revisit conditions: A future product direction requires customer accounts.

## ADR-006 - Booking as Central Domain Object

Status: Accepted

Date: 2026-08-18

Context: The main operational need is converting an informal agreement into a structured record.

Decision: Bookings/orders are the primary operational domain object.

Rationale: Customers, confirmations, fulfilment, feedback, and analytics all revolve around bookings.

Consequences: Booking integrity and lifecycle state definitions must be carefully designed.

Revisit conditions: Product discovery shows another domain object is more central.

## ADR-007 - Customer Transactions Outside Platform

Status: Accepted

Date: 2026-08-18

Context: Initial product scope excludes processing payments between vendors and their customers.

Decision: V1 does not process payment between customer and vendor.

Rationale: The product focuses on operational record keeping, not payment processing.

Consequences: Deposit and balance fields may track agreements, but payment collection is out of scope.

Revisit conditions: Payment processing becomes an accepted product strategy.

## ADR-008 - Vendor Subscription Billing Separate

Status: Accepted

Date: 2026-08-18

Context: My Customers will eventually need subscription billing for vendors.

Decision: My Customers subscription billing is separate from business customer transactions.

Rationale: Platform subscription billing and vendor/customer payments have different responsibilities and risk profiles.

Consequences: Billing provider integration must sit behind a server-side abstraction.

Revisit conditions: Billing model changes materially.

## ADR-009 - Server + RLS Authorization

Status: Accepted

Date: 2026-08-18

Context: Tenant-owned data must be protected against cross-tenant access.

Decision: Tenant authorization must not rely solely on client-side filtering. Use server authorization plus database RLS where appropriate.

Rationale: Frontend visibility is not authorization. Defense in depth is required for Supabase-exposed data.

Consequences: Future schema work must include RLS policy design and tests.

Revisit conditions: Data access architecture changes away from Supabase-exposed tenant data.

## ADR-010 - Customers Use Secure Web Links

Status: Accepted

Date: 2026-08-18

Context: Customers should not need My Customers accounts for booking confirmation or feedback.

Decision: Customer booking confirmation and feedback interactions use scoped web links rather than requiring customer accounts.

Rationale: This matches the lightweight customer experience and informal sales channels.

Consequences: Tokens must be scoped, expiring, revocable, and protected against abuse.

Revisit conditions: Customer account functionality becomes a deliberate product goal.

## ADR-011 - Business Membership Role Representation

Status: Accepted

Date: 2026-08-18

Context: Phase 2 needs a minimal role model for tenant authorization without building staff management.

Decision: Represent membership roles as a PostgreSQL enum with `owner` and `member`.

Rationale: The enum constrains stored values and keeps Phase 2 intentionally small.

Consequences: New roles require a migration and product decision.

Revisit conditions: Staff permissions require more granular roles.

## ADR-012 - Profile Provisioning Mechanism

Status: Accepted

Date: 2026-08-18

Context: Every authenticated Supabase user should have an application profile.

Decision: Provision profiles with a minimal Auth `auth.users` insert trigger that inserts `profiles` and a signup audit event.

Rationale: This keeps profile lifecycle close to identity creation without adding business onboarding logic to the trigger.

Consequences: Trigger behavior must be tested when a Supabase database is available.

Revisit conditions: Supabase Auth lifecycle requirements become more complex.

## ADR-013 - Current Business Resolution

Status: Accepted

Date: 2026-08-18

Context: The system must support users with multiple business memberships later.

Decision: Database membership is authoritative. Phase 2 selects the first active membership as the current business only for interim application context.

Rationale: This avoids encoding a permanent one-user-one-business assumption.

Consequences: Phase 3 or later can replace this with explicit business selection.

Revisit conditions: Multiple memberships become common enough to require a switcher.

## ADR-014 - RLS Membership Helper Strategy

Status: Accepted

Date: 2026-08-18

Context: Business and membership RLS policies need to check membership without recursive-policy failures.

Decision: Use narrow `private` schema security-definer helper functions for membership and role checks, with safe `search_path` and limited grants.

Rationale: This avoids weakening tenant isolation while preventing recursive access policies on `business_members`.

Consequences: Helper functions require careful review and runtime database tests.

Revisit conditions: Policy design changes or Supabase guidance changes materially.

## ADR-015 - Audit Event Strategy

Status: Accepted

Date: 2026-08-18

Context: Phase 2 needs audit infrastructure without allowing browser clients to fabricate security events.

Decision: Store audit logs in an RLS-protected table with no authenticated browser write policy. Server-only service-role helpers record application audit events when configured.

Rationale: This prevents arbitrary client-side audit event fabrication.

Consequences: Environments without service-role configuration skip application audit writes and remain verification-pending.

Revisit conditions: A database RPC or dedicated audit service becomes necessary.

## ADR-016 - Atomic Business Onboarding RPC

Status: Accepted

Date: 2026-08-18

Context: Phase 3 must create a business and owner membership atomically for an
authenticated user while preserving Phase 2 RLS and preventing client-supplied
owner identity from becoming trusted authorization data.

Decision: Use a narrow `public.create_business_onboarding` Supabase RPC as a
`SECURITY DEFINER` function with safe `search_path`, explicit validation, and
`EXECUTE` restricted to `authenticated`. The function derives ownership from
`auth.uid()`, creates the `businesses` row, creates the owner membership, records
safe audit metadata, and resolves slug collisions inside the same transaction.

Rationale: Supabase client calls cannot make two table mutations atomic without
a database transaction boundary. Direct authenticated inserts into
`business_members` would weaken membership controls. A narrow RPC keeps the
creation path explicit and testable.

Consequences: Future changes to onboarding fields or role creation must update
the RPC, generated database types, runtime security tests, and documentation.

Revisit conditions: A broader server-side transaction mechanism replaces the
Supabase RPC boundary, or business onboarding becomes multi-business/switcher
driven.

## ADR-017 - Booking Money Uses Integer Minor Units

Status: Accepted

Date: 2026-08-18

Context: Phase 5 needs to track agreed booking value, deposit recorded, and
balance without processing payments or introducing currency conversion.

Decision: Store booking money as integer minor units in
`total_amount_minor` and `deposit_amount_minor`; derive balance instead of
storing it.

Rationale: Integer minor units avoid floating-point rounding errors, keep
validation simple, and match the current requirement to track terms rather than
settle payments.

Consequences: UI forms parse decimal user input into integer minor units before
writing. Database constraints enforce nonnegative values and deposit not
exceeding total. Future payment or tax features must decide whether additional
precision, provider amounts, or item-level money records are needed.

Revisit conditions: Supported currencies require non-2-decimal minor unit
behavior, payment provider integration requires provider-specific amount
handling, or tax/discount/line-item calculations become accepted scope.

## ADR-018 - Phase 5 Booking Items Deferred

Status: Accepted

Date: 2026-08-18

Context: The Phase 5 brief allows lightweight booking items only if they are
materially worth the complexity.

Decision: Do not implement `booking_items` in Phase 5. Use booking-level title,
description, scheduled date, total, deposit, balance, status, and internal notes
as the operational record.

Rationale: Adding item rows would imply line-item totals, catalog semantics,
inventory or fulfilment details, and item editing rules that are not required to
complete the primary booking workflow.

Consequences: Phase 5 supports structured booking records but not itemized
orders. Later phases can introduce `booking_items` with a focused migration and
tests when the product semantics are explicit.

Revisit conditions: Vendors need itemized order capture, per-item fulfilment,
catalog integration, inventory, discounts, or item-level analytics.

## ADR-019 - Confirmation Tokens Are Opaque Capabilities Stored Hash-Only

Status: Accepted

Date: 2026-08-19

Context: Phase 6 exposes customer-facing booking confirmation links without
requiring customer accounts. Booking references are human-readable and must not
authorize public access.

Decision: Use cryptographically random opaque tokens for confirmation links,
store only SHA-256 token hashes, and show the raw token only once to the vendor
after generation.

Rationale: Opaque high-entropy tokens avoid enumerable public credentials.
Hash-only storage reduces the impact of database reads or logs exposing
confirmation link rows.

Consequences: The application cannot recover an existing raw confirmation URL
after generation. Vendors must regenerate a link if the raw URL is lost.
Future email automation must send the raw token at creation time without
persisting it in audit logs or database tables.

Revisit conditions: A future customer-account model replaces token links, or
the product adopts a keyed token format with a stronger documented threat model.

## ADR-020 - Confirmation Evidence Uses Immutable Terms Snapshots

Status: Accepted

Date: 2026-08-19

Context: Customers confirm the booking terms shown at a point in time. Material
booking changes after confirmation must not silently change what the customer
already accepted.

Decision: Store a confirmation terms snapshot and SHA-256 terms hash when a
customer confirms a booking. Material changes invalidate the current booking
confirmation and require a new confirmation, while used links continue to show
the immutable snapshot originally confirmed.

Rationale: Snapshot evidence preserves what was confirmed and prevents mutable
booking edits from rewriting confirmation history.

Consequences: Material-field definitions must be kept consistent between
application tests and database trigger logic. Future fields that affect customer
terms must be added to the snapshot and material-change classifier.

Revisit conditions: The product introduces negotiated revisions, multi-party
approval, or legally versioned terms requiring a richer confirmation model.

## ADR-021 - Public Confirmation Uses Server-Only RPC Boundary

Status: Accepted

Date: 2026-08-19

Context: Public confirmation pages need to validate tokens and reveal a minimal
booking view without granting anonymous table access to confirmation or booking
data.

Decision: Keep confirmation-link tables unavailable to `anon` and
`authenticated` table APIs. Public page code uses server-only service-role RPCs
for minimized lookup and atomic confirmation, plus a persistent database-backed
rate limiter keyed by hashed request identity.

Rationale: A narrow server-only boundary preserves least privilege, avoids
public table policies for token data, and keeps GET previews non-consuming while
POST confirmation remains atomic.

Consequences: Environments without a configured service-role key cannot serve
public confirmation flows. Future hosting and observability must avoid logging
raw confirmation URLs or tokens.

Revisit conditions: A dedicated edge function or separate public API service
replaces the Next.js server boundary.

## ADR-022 - Operational Booking Transitions Use Authenticated RPCs

Status: Accepted

Date: 2026-08-19

Context: Phase 7 needs vendors to move bookings through fulfilment while
preserving the Phase 5/6 integrity trigger, tenant RLS, immutable history, and
customer confirmation requirements.

Decision: Route vendor operational lifecycle changes through
`public.transition_booking_status`, a narrow authenticated Supabase RPC. The RPC
derives the actor from `auth.uid()`, checks active business membership, locks
the booking row, applies the accepted transition graph, lets database trigger
logic set operational timestamps, and records audit events. Direct
authenticated browser status updates remain blocked.

Rationale: The lifecycle graph is security-sensitive business state. A database
transaction boundary avoids split-brain updates between booking status,
timestamps, history, and audit logs while keeping ordinary browser clients from
fabricating operational history.

Consequences: Future workflow actions that change booking status must extend
the RPC and tests rather than adding direct table updates from server actions or
client code. Staff-role permissions, notifications, or automation must preserve
the same authorization and audit boundary.

Revisit conditions: A dedicated application service with explicit transactions
replaces the Supabase RPC boundary while preserving RLS, row locking, trigger
behavior, and equivalent runtime security tests.

## ADR-023 - Rescheduling Uses Focused Booking Change History

Status: Accepted

Date: 2026-08-19

Context: Phase 7 needs operational rescheduling before fulfilment begins.
Generic event sourcing would add complexity beyond the current product need,
but reschedules are material enough to require an auditable record and customer
reconfirmation when already confirmed.

Decision: Implement `public.reschedule_booking` for `DRAFT`,
`AWAITING_CUSTOMER`, and `CONFIRMED` bookings only, and record reschedule rows
in `public.booking_changes`. Rescheduling a confirmed booking returns it to
`AWAITING_CUSTOMER`, clears current confirmation fields, revokes open
confirmation links, writes `BOOKING_RESCHEDULED`, and requires a new customer
confirmation. Non-material internal-note edits continue not to invalidate
confirmation.

Rationale: A focused `booking_changes` table captures the operational history
users need now without implying a broad event-store model. Keeping rescheduling
inside a database RPC preserves tenant checks and material-change invalidation
in one transaction.

Consequences: Future material fields must be classified deliberately. If
rescheduling after work starts is later required, the product must define
customer notification, cancellation, staff ownership, and audit semantics before
changing the allowed status set.

Revisit conditions: The product introduces full revision workflows, customer
change approvals, staff scheduling, or broader event sourcing.

## ADR-024 - Feedback Tokens Use A Dedicated Purpose Boundary

Status: Accepted

Date: 2026-08-19

Context: Phase 8 needs customers to submit private feedback after a booking is
completed without creating My Customers accounts. Confirmation tokens already
exist, but confirmation and feedback authorize different actions and happen at
different lifecycle stages.

Decision: Implement feedback links as separate opaque, high-entropy,
hash-at-rest capabilities with purpose `booking_feedback`, a default 14-day
lifetime, one open link per booking, and server-only public lookup/submission
RPCs. Do not reuse confirmation links or booking references for feedback access.

Rationale: A distinct purpose boundary prevents a valid customer token from
being replayed against another customer-facing action. Hash-only storage keeps
raw feedback URLs out of tables and audit metadata.

Consequences: Existing raw feedback URLs cannot be recovered after generation.
Future notification or email automation must send the raw URL at creation time
without persisting it, and future customer token types need their own explicit
purpose model and tests.

Revisit conditions: Customer accounts replace token links, or a broader
capability-token service is introduced with equivalent purpose isolation and
runtime attack tests.

## ADR-025 - Feedback Remains Private And Immutable

Status: Accepted

Date: 2026-08-19

Context: Phase 8 collects customer sentiment to help vendors improve operations,
not to publish public reviews or create editable testimonials.

Decision: Store feedback as an immutable private tenant record attached to the
completed booking, customer, and consumed feedback link. Authenticated vendors
can read feedback for their business, but ordinary clients cannot update or
delete submitted feedback.

Rationale: Immutability preserves the customer's submitted answer and avoids
turning private operational feedback into mutable marketing content. Tenant RLS
keeps feedback visible only to the owning business.

Consequences: Corrections or moderation workflows require a future explicit
design rather than ad hoc updates. Phase 9 analytics may aggregate feedback
ratings and boolean answers, but must not expose comments or cross-tenant data.

Revisit conditions: A legally required deletion/correction workflow, public
review feature, or moderation process is accepted as future scope.

## ADR-026 - Booking Issues Are Internal Terminal Records

Status: Accepted

Date: 2026-08-19

Context: Vendors need to record operational problems discovered during or after
booking fulfilment. These records are internal business notes, not customer
support tickets or public status updates.

Decision: Model booking issues as tenant-owned internal records with a bounded
category, private description, `OPEN` or `RESOLVED` status, database-derived
actor/timestamps, and terminal resolution. Do not expose issues on public
customer-facing links.

Rationale: A small issue lifecycle gives vendors useful operational memory
without introducing staff assignment, customer messaging, SLA tracking, or
public reporting complexity before those phases are designed.

Consequences: Resolved issues cannot be reopened in Phase 8. Phase 9 may
aggregate issue categories and resolution rates, but future staff assignment,
escalation, customer-visible support, or richer analytics must extend this model
through a migration and authorization review.

Revisit conditions: The product requires multi-step issue workflows, customer
support conversations, staff ownership, or public issue status.

## ADR-027 - Analytics Are Derived Tenant-Private Aggregates

Status: Accepted

Date: 2026-08-19

Context: Phase 9 needs useful business insights without creating public reports,
billing claims, forecasting, or a separate analytics data store.

Decision: Calculate Phase 9 insights from persisted tenant records through a
narrow authenticated PostgreSQL RPC that checks active business membership and
returns aggregate JSON. Do not add analytics tables, materialized views, public
reporting endpoints, exports, forecasting, AI recommendations, or
analytics-specific roles in Phase 9.

Rationale: The database can aggregate close to the data while preserving tenant
authorization. Returning aggregate JSON avoids pulling large row sets into the
application and avoids privileged views that could bypass RLS.

Consequences: Analytics are deterministic and recomputed from current stored
records. Future caching, exports, reporting emails, staff visibility controls,
or billing analytics require explicit design and tenant-security review.

Revisit conditions: Query volume requires caching/materialization, reporting
exports are accepted, or analytics need role-specific visibility different from
ordinary active business membership.

## ADR-028 - Confirmation Contact And Email Delivery Are Durable Evidence

Status: Accepted

Date: 2026-08-20

Context: Booking confirmation needs a usable communication address without
turning customers into authenticated users or making external email part of the
critical database transaction.

Decision: Require normalized customer-provided email and allow optional phone
on the secure confirmation action. Preserve both on immutable confirmation
evidence. Populate only empty customer contact fields and never silently replace
an existing different value. Atomically create one private
`BOOKING_CONFIRMED` outbox event, then claim and deliver it after commit through
a server-only provider-neutral boundary.

Rationale: Confirmation remains race-safe and durable while contact history is
not lost when a customer record later changes. Provider latency or failure
cannot create a false booking failure or hold database locks open.

Consequences: Submitted email is not ownership-verified. Failed events remain
durable and claimable for a future retry worker. Production delivery requires
explicit Resend sender configuration; the development adapter performs no
external send.

Revisit conditions: Contact ownership verification, customer-managed contact
updates, retry scheduling, additional lifecycle event types, or another email
provider is accepted into scope.

## ADR-029 - Booking May Create Its Required Customer Atomically

Status: Accepted

Date: 2026-08-20

Context: Requiring vendors to leave New Booking and create a customer first
preserved the data model but added avoidable workflow friction. Making
`customer_id` optional or inserting customer and booking in separate requests
would weaken the invariant or leave orphan records on partial failure.

Decision: Keep every booking attached to exactly one same-business customer,
while allowing New Booking to select an active customer or create a minimal
customer inline. Route both modes through
`public.create_booking_with_customer`, a narrow authenticated transaction that
derives actor and current business, preserves existing booking triggers, and
records customer/booking audits atomically.

Exact normalized active-customer name, email, or phone matches produce a
tenant-scoped warning. They never auto-merge or silently switch the customer.
Archived customers remain unavailable for new bookings and require a future
explicit restoration design.

Rationale: One transaction removes the failure gap while retaining the
booking/customer/business constraint and one authoritative booking creation
mechanism. Explicit modes and warnings keep vendor intent visible.

Consequences: The bounded active-customer picker remains current technical debt;
paginated server search and sophisticated deduplication/merge are deferred.
Concurrent intentional submissions are independent transactions and no broad
idempotency framework is introduced.

Revisit conditions: Customer volumes require server-paginated picker search, a
reviewed merge/restoration workflow is accepted, or booking submission gains a
product-level idempotency contract.

## ADR-030 - Main Integration Requires GitHub Actions Quality Gates

Status: Accepted

Date: 2026-08-21

Context: Shared branches diverged while product, security, migration, and UI
work continued independently. Repository integration needs repeatable checks
without turning ordinary pull-request CI into a production deployment path.

Decision: Run least-privilege GitHub Actions for pull requests into and pushes
to `main`. Require separate Quality, Tests, Build, E2E, and Dependency Security
checks. Define live runtime security behind an explicit protected non-production
Supabase environment and enable it only when safe secrets exist. Never migrate
production or deploy infrastructure from this workflow.

Rationale: Named jobs make failures attributable, `npm ci` keeps installs
reproducible, and protected secrets allow real browser and RLS verification
without exposing the service role. Keeping deployment separate prevents a code
quality workflow from gaining unnecessary write authority.

Consequences: Core E2E requires dedicated Supabase CI secrets. Runtime Security
is configuration-pending until its environment is deliberately enabled. Branch
protection must be configured in GitHub to make the core checks merge-blocking.

Revisit conditions: A safe local Supabase CI architecture replaces remote test
fixtures, GitHub changes its supported action/runtime model, or a separately
approved production deployment pipeline is introduced.

## ADR-031 - Business Logos Use One Bounded Public Object Per Tenant

Status: Accepted

Date: 2026-08-21

Context: A business logo must appear on authenticated and customer-facing pages,
but general media storage, raw uploads, and sensitive documents are outside this
pass. The object must be publicly readable while mutations remain tenant-safe.

Decision: Store one deterministic `{business_id}/logo.webp` object in the
public `business-logos` bucket. Authorize object select/list, insert, update, and
delete for active owners only through Storage RLS. Validate source MIME,
extension, decoded format, bytes, dimensions, and animation server-side; resize
with aspect ratio preserved, strip source metadata, encode WebP, and enforce the
bucket's 200 KB persisted limit. Store only `logo_path` in `businesses`.

Rationale: A logo-only public bucket is the simplest safe customer-display
model. Deterministic overwrite prevents abandoned replacements, while owner
RLS and an exact-path parser prevent cross-tenant writes or arbitrary object
names. No service-role storage credential reaches the browser.

Consequences: Public URLs are readable by anyone who has the asset URL, as
expected for business branding. Anonymous callers cannot list the bucket or
mutate objects. Removal clears the database reference before object cleanup; a
cleanup failure leaves a harmless unreferenced public logo and is reported for
retry rather than restoring a broken database reference. Future uploaded image
features must define equivalent bounds, optimization, access, and cleanup.

Revisit conditions: Multiple brand assets, private media, CDN transformations,
or a generalized media library is accepted into scope.

## ADR-032 - Confirmed Booking Terms Are Historical Evidence

Status: Accepted

Date: 2026-08-23

Context: The previous trigger allowed an ordinary material edit to a confirmed
booking to invalidate confirmation and return the booking to
`AWAITING_CUSTOMER`. That protected current state but still allowed the agreed
record to be silently rewritten. Cancellation also lacked a durable customer
notification event.

Decision: Deny ordinary changes to customer, title, customer-facing
description, currency, total, deposit, and schedule from `CONFIRMED` onward at
the database boundary. Keep `public.reschedule_booking` as the explicit current
exception that invalidates confirmation and requires reconfirmation. Keep
internal notes editable before terminal states. Confirmed cancellation requires
a bounded plain-text reason, preserves immutable confirmation evidence, and
atomically creates one `BOOKING_CANCELLED` outbox event using confirmation
contact before any customer-record fallback.

Rationale: The confirmation snapshot must describe what the customer agreed,
while the booking row must not imply those same terms were later edited in
place. Cancellation is a new historical lifecycle fact, not a rewrite of the
agreement. Durable event creation separates database truth from external
provider availability.

Consequences: Ordinary confirmed-term edits fail instead of initiating
reconfirmation. Explicit rescheduling remains available before work starts.
Provider failure leaves the booking cancelled and the event retryable. Draft
and awaiting-customer cancellations do not send a cancellation email because no
current confirmed agreement exists.

Revisit conditions: An explicit amendment model is implemented with customer
reconfirmation, or linked add-ons are introduced without rewriting the original
agreement. Add-ons with independent fulfilment schedules remain separate
bookings.

## ADR-033 - General Material Changes Use A Dedicated Customer-Approved Amendment

Status: Accepted

Date: 2026-08-23

Context: Phase A permanently prevents ordinary rewrites of customer-confirmed
terms. `booking_changes` preserves completed reschedule history but cannot
safely represent a pending structured proposal, separate capability lifecycle,
stale-base concurrency, or customer approval evidence.

Decision: Add `booking_amendments` as the pending/evidence aggregate and extend
`booking_changes` only for the applied history row. A proposal freezes complete
old/proposed terms, changed fields, hashes, reason, and authoritative booking
contact while leaving `bookings` unchanged. V1 permits one pending request only
for `CONFIRMED` or `IN_PROGRESS`, excludes customer reassignment and internal
notes, and supports vendor revoke but no customer decline/chat. A distinct
24-hour hash-only token is confirmed through a service-only atomic RPC that
checks the current effective hash before applying terms through a transaction-
local trigger exception.

Reschedule decision: Keep existing reschedule as the specialized date-only,
pre-work reconfirmation workflow. It returns confirmed bookings to
`AWAITING_CUSTOMER` and revokes any pending general amendment. A general
amendment can include schedule with other fields and does not change booking
status. Cancellation and advancement to `READY` also revoke pending amendments.

Consequences: Original confirmation and every proposed/effective amendment can
be reconstructed; analytics use current canonical values once; the outbox gains
request/confirmed subjects. Because raw tokens are never persisted, a failed
request email cannot later reconstruct its link; the vendor revokes/replaces the
request to issue a new link. Confirmation email retry data is fully durable.

Add-on boundary: Phase C implements linked new scope without rewriting original
or amendment evidence.

Revisit conditions: Product requirements introduce customer negotiation,
multiple simultaneous proposals, amendments after `READY`, customer
reassignment, or independently scheduled add-on fulfilment.

## ADR-034 - New Booking Scope Uses Linked Customer-Confirmed Add-ons

Status: Accepted

Date: 2026-08-23

Context: General amendments safely change existing agreed scope, but using them
for additional products or services would erase the distinction between changed
terms and newly purchased scope. Rewriting booking totals would also weaken the
confirmed-agreement evidence model.

Decision: Store new scope in `booking_addons`, separate from `bookings`,
`booking_confirmations`, and `booking_amendments`. Limit V1 creation to
`CONFIRMED` and `IN_PROGRESS`; inherit parent currency and current schedule;
use integer minor units and a minimal DRAFT/AWAITING_CUSTOMER/CONFIRMED/CANCELLED
state machine. Confirm through a distinct 24-hour hash-only capability. Pending
add-ons never affect totals; all confirmed add-ons contribute to derived current
value and analytics without increasing booking count. Confirmed add-ons are
immutable.

Interaction decision: Permit one awaiting add-on per booking and never alongside
a pending amendment. Reschedule, cancellation, and advancement to `READY`
cancel pending add-ons and revoke open links. Confirmed add-ons survive parent
cancellation as historical evidence. A separately scheduled or fulfilled item
is a new booking.

Consequences: Original and amendment agreement evidence remains reconstructable;
the current financial view is a derivation rather than a rewritten booking row;
request/confirmation email and audit events remain add-on-specific. Confirmed
add-on correction/cancellation requires a future explicit evidence-preserving
workflow rather than direct mutation.

Revisit conditions: Customer rejection/chat, independently delivered additions,
catalog/inventory, or explicit confirmed add-on correction/cancellation enters
accepted scope.

## ADR-035 - Current Business Is A Validated Preference, Not Tenant Authority

Status: Accepted

Date: 2026-08-24

Context: One authenticated account can own or join multiple businesses, while
existing private routes need one current tenant for ordinary workflows.

Decision: Keep `business_members` and RLS as authorization authority. Persist
only a preferred business UUID in an HTTP-only, same-site cookie. Resolve that
value server-side against ordered active memberships on every dynamic dashboard
request, falling back deterministically or onboarding when none remain. Do not
add `profiles.business_id`. Switches use a membership-validating server action;
new businesses reuse atomic onboarding and become current.

Consequences: Role and tenant scope change together after a full dashboard
redirect. A forged or stale cookie cannot grant access. Private data remains
business-scoped, while public capability routes do not read account preference.
The dashboard context performs one membership query and one bounded business
identity query per request.

Revisit conditions: Membership volumes require pagination, server-side
preference persistence becomes a cross-device requirement, or invitations and
membership administration enter scope.

## ADR-036 - Google Authentication Uses Supabase Auth And The Existing Callback

Status: Accepted

Date: 2026-08-24

Context: Email/password remains required, while users need Google as an optional
authentication convenience without creating a second identity or tenant model.

Decision: Use Supabase `signInWithOAuth` with provider `google`, the configured
application URL, and the existing `/auth/callback` PKCE exchange. Carry only the
sanitized local post-auth destination in a ten-minute HTTP-only, same-site cookie
scoped to the callback; keep the Supabase redirect target on the exact existing
`/auth/callback?next=/dashboard` allowlist entry. Provider enablement and Google
Web credentials are owned by Supabase Auth, not Vercel or client code. All users
continue through the same profile trigger, onboarding, membership resolution,
RLS, and logout boundaries.

Consequences: A disabled or unavailable provider fails closed without exposing
raw OAuth errors. No Google secret enters the application environment. Supabase
documents automatic linking for matching verified emails, but this project's
actual same-email behavior cannot be runtime-verified until Google is configured;
the application performs no email-based user creation or manual linking.

Revisit conditions: Provider configuration is completed, explicit manual account
linking becomes a product requirement, or another reviewed provider enters scope.

## ADR-037 - Platform Administration Uses Separate Database Authority

Status: Accepted

Decision: Platform administration is authorized by a dedicated
`platform_admins` row linked to `auth.users.id`. Tenant roles in
`business_members` never imply platform authority. Admin Phase 1 defines only
`SUPER_ADMIN` and requires `ACTIVE` status on every admin request through a
self-scoped authenticated RPC. Browser roles receive no direct admin-table
privileges.

The initial administrator is provisioned through a controlled, audited UUID
operation. There is no email allowlist, profile boolean, self-service bootstrap,
client role claim, generic service-role query helper, or admin-management UI.
Authority changes are audited, while ordinary page navigation is not.

Consequences: Admin revocation takes effect on the next server render without
deleting the Auth account. Future admin data reads and writes require narrow
post-authorization boundaries, operation-specific audit semantics, and runtime
security tests. MFA should be enforced before high-risk admin writes are enabled.

## ADR-038 - Admin Operational Overview Uses An Aggregate-Only RPC

Status: Accepted

Decision: Admin Phase 2 reads platform operations through one stable,
`SECURITY DEFINER` database function with an empty search path and an active
`SUPER_ADMIN` caller check. The normal authenticated server client invokes the
function after the route guard. The result contains counts and a refresh
timestamp only; no generic service-role client or record-level query API is
available to the page.

Rationale: RLS intentionally prevents broad cross-tenant browser reads. A narrow
database projection keeps privileged access reviewable, avoids transferring PII,
and computes globally consistent counts in one statement. Current-business state
cannot affect the function.

Consequences: New metrics require an explicit migration, semantics update, and
exact runtime regression. Record lists, search, money, exports, and writes remain
out of scope and cannot be inferred from this boundary.
