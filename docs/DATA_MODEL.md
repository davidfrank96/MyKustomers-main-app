# Data Model

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

This document describes the planned conceptual data model and current migration evidence. Documentation is not implementation evidence.

## 2026-09-01 Delivery-To-Feedback Automation

Migration `20260901194500_delivery_feedback_automation.sql` adds
`feedback_links.token_version smallint NOT NULL DEFAULT 0` and nullable
`email_events.feedback_link_id`. Existing rows remain version 0. New version 1
links store only the HMAC-derived token hash and are deterministically
recoverable inside SECURITY DEFINER functions using the named Supabase Vault
secret `mykustomers_feedback_capability_hmac_v1`; the secret value is not an
application column, migration literal, function result, log field, or document.

`deliver_booking_with_feedback` locks the tenant booking, performs the normal
`READY -> DELIVERED` mutation, creates or recovers one open feedback link, and
creates the exact `BOOKING_DELIVERED` event with `feedback_link_id` atomically.
An idempotent retry for the same delivered/completed booking returns the same
link/event relationship. `create_or_recover_booking_feedback_link` is the manual
same-link path. The outbox dispatcher obtains short-lived delivery context
through the service-role-only `get_delivery_feedback_dispatch_context`; it
cannot select an unrelated link and cannot reconstruct one after 48 hours.

Feedback submission is now valid for the associated booking in `DELIVERED` or
`COMPLETED`. If authoritative outstanding payment is already zero, submission
also performs `DELIVERED -> COMPLETED`; otherwise the feedback is stored and the
booking remains delivered. A later final payment completes it. Manual completion
remains available after payment reconciliation. Historical v0 capabilities,
feedback, bookings, and email events are not rewritten.

Forward migration `20260901205018_delivery_feedback_legacy_compatibility.sql`
changes only the two deferred delivery-association enforcement functions. During
the application rollout window, a `BOOKING_DELIVERED` event may retain the
historical null `feedback_link_id` shape, but delivery must still produce exactly
one event. Any non-null association remains tenant/booking exact, version 1,
`booking_feedback` purpose, immutable, and protected by the composite foreign
key. Historical null events are not backfilled or reinterpreted. Production
convergence is now demonstrated by two controlled post-deploy delivery events,
zero null associations, and two exact version 1 links. Separate forward
migration `20260901230527_delivery_feedback_require_v1_association.sql` restores
the new-delivery non-null invariant for future writes and contains a fail-closed
cutoff precondition. It was explicitly approved and applied after rollout
verification. It does not rewrite historical rows; all future delivery events
must now carry an exact version 1 `booking_feedback` association.

## 2026-09-01 Customer Lifecycle And Confirmation Request Evidence

`20260901090000_customer_safe_delete.sql` adds no customer column and no booking
deletion relationship. It adds the owner-authorized
`delete_customer_if_eligible(uuid)` mutation boundary and `CUSTOMER_DELETED`
audit type. Eligibility means the current tenant customer exists and has no row
in `bookings`; the locked database check, not list UI state, is authoritative.

`20260901090010_booking_confirmation_request_event_type.sql` and
`20260901090011_booking_confirmation_request_outbox.sql` add
`BOOKING_CONFIRMATION_REQUESTED`, require its exact
`email_events.confirmation_link_id`, and enforce one request event per link.
`create_booking_confirmation_request` serializes on the booking, validates the
member and recipient, returns a normal duplicate result for the same normalized
recipient within 30 seconds, or atomically revokes open links and inserts a new
hash-only capability plus event. No raw capability is persisted in the event or
audit metadata. Existing historical values and links are not rewritten.

Customer-contact normalization is `trim(local-part) + '@' + lower(domain)`
after supported syntax validation. This policy applies to booking customer
contact, confirmation, amendment, add-on, and outbox paths only; Auth identity
comparison remains outside this change.

The immutable repository migration ledger and deployment discipline are
documented in `docs/MIGRATIONS.md`.

Phase 2 migration evidence exists at `supabase/migrations/20260818113552_phase_2_auth_tenancy.sql`. The Phase 2 entities were applied to the configured development Supabase database and runtime-verified during Phase 2V.

Phase 3 migration evidence exists at `supabase/migrations/20260818140502_phase_3_business_onboarding.sql`. The migration was applied to the configured development Supabase database and runtime-verified for business onboarding and tenant authorization.

Phase 4 migration evidence exists at `supabase/migrations/20260818142125_phase_4_customer_management.sql`. The migration was applied to the configured development Supabase database and runtime-verified for customer tenant isolation, customer CRUD, archive behavior, and search isolation.

Phase 5 migration evidence exists at
`supabase/migrations/20260818222232_phase_5_booking_engine.sql`. The migration
defines bookings, booking status history, booking status and currency enums,
tenant RLS, booking/customer business consistency, immutable booking ownership
fields, and lifecycle integrity triggers. The migration was applied to the
configured development Supabase database and runtime-verified for booking tenant
isolation and integrity.

Phase 6 migration evidence exists at
`supabase/migrations/20260818230911_phase_6_secure_customer_confirmation_links.sql`.
The migration defines secure confirmation links, immutable confirmation
evidence, persistent rate-limit buckets, `AWAITING_CUSTOMER` booking status,
current confirmation terms fields, server-only public confirmation RPCs, and
updated booking lifecycle integrity. The migration was applied to the configured
development Supabase database and runtime-verified for token lifecycle,
minimized public data, one-time confirmation, material-change invalidation, and
tenant isolation.

Trusted confirmation sharing migration evidence exists at
`supabase/migrations/20260823105232_trusted_confirmation_sharing.sql`. It adds
nullable `confirmation_links.first_opened_at`, truthful share/open audit enum
values, and the idempotent service-role-only
`public.record_confirmation_link_open` RPC. It adds no public table grants and
was applied to development with Phase 6 runtime verification.
Forward migration
`supabase/migrations/20260823111107_trusted_confirmation_open_race_fix.sql`
allows a delayed hydration signal after the same link has atomically confirmed,
but only when immutable confirmation evidence exists; revoked/unknown links
remain rejected.

Customer contact and confirmation-email foundation migration evidence exists at
`supabase/migrations/20260820131919_customer_contact_confirmation_email_foundation.sql`.
It adds immutable confirmation contact fields and the private durable
`email_events` outbox, replaces the confirmation RPC so contact capture and
event creation are atomic, and adds a service-role-only event claim RPC. It was
applied to the configured development Supabase database and runtime-verified.

Inline customer booking migration evidence exists at
`supabase/migrations/20260820143032_inline_customer_booking_creation.sql`. It
adds no tables and keeps `bookings.customer_id` required. It defines
`public.create_booking_with_customer`, an authenticated transaction that derives
the actor and current business, validates an active same-business existing
customer or creates a new customer, creates the booking, and records required
audit events atomically. The migration was applied to development and
runtime-verified for rollback, tenant isolation, grants, history, and
concurrency.

Business identity migration evidence exists at
`supabase/migrations/20260821125815_business_identity_logo_storage.sql` with
the forward runtime correction
`supabase/migrations/20260821132030_business_identity_runtime_fixes.sql`.
Together they add nullable `businesses.website` and `businesses.logo_path`, the
public logo-only `business-logos` bucket, exact-path owner policies, onboarding
website support, and public confirmation identity while preserving later masked
confirmation contact. Both migrations are applied to development and the full
live runtime security suite passes.

Phase 7 migration evidence exists at
`supabase/migrations/20260818234428_phase_7_fulfilment_operational_lifecycle.sql`.
The migration adds operational booking timestamps, cancellation reasons,
`booking_changes`, controlled lifecycle/reschedule RPCs, operational indexes,
and updated booking integrity triggers. The migration was applied to the
configured development Supabase database and runtime-verified for fulfilment
lifecycle security, rescheduling behavior, status/change integrity, audit
events, and tenant isolation.

Phase 8 migration evidence exists at
`supabase/migrations/20260819001954_phase_8_private_feedback_issues.sql`.
The migration adds private feedback links, immutable feedback submissions,
operational booking issues, issue enums, integrity triggers, public feedback
RPCs, RLS policies, grants, and audit event types. The migration was applied to
the configured development Supabase database and runtime-verified for feedback
token lifecycle, public minimization, tenant isolation, issue lifecycle
authorization, concurrency, and audit behavior.

Trusted feedback sharing migration evidence exists at
`supabase/migrations/20260824133925_trusted_feedback_sharing.sql`. It adds
nullable `feedback_links.first_opened_at`, `FEEDBACK_SHARE_INITIATED` and
`FEEDBACK_OPENED` audit values, and the service-role-only idempotent
`public.record_feedback_link_open` RPC. The migration was applied to the
configured development database and the focused live Phase 8 suite verified
open idempotency, direct-role denial, purpose separation, and raw-token absence
from audit metadata.

Phase 9 migration evidence exists at
`supabase/migrations/20260819010145_phase_9_business_insights_analytics.sql`
and follow-up fix
`supabase/migrations/20260819011341_phase_9_fix_insights_current_time.sql`.
Targeted correction
`supabase/migrations/20260820030000_phase_9_fix_booking_trend_buckets.sql`
buckets completed booking trends by `completed_at` without changing tables or
metric definitions. The Phase 9 migrations add targeted indexes for analytics predicates and the
authenticated aggregate RPC `public.get_business_insights`. It does not add
analytics tables, views, materialized views, public reports, or stored snapshots.

Detailed schema design belongs to the relevant implementation phase.

## Conceptual Entities

- `profiles`
- `businesses`
- `business_members`
- `customers`
- `bookings`
- `booking_items`
- `booking_status_history`
- `booking_changes`
- `booking_addons`
- `booking_addon_confirmation_links`
- `confirmation_links`
- `feedback_links`
- `feedback`
- `booking_issues`
- `analytics`
- `subscriptions`
- `subscription_events`
- `email_events`
- `audit_logs`

These names are conceptual and not yet necessarily final table names.

## Entity Status

- `profiles`: VERIFIED.
- `businesses`: VERIFIED. Phase 3 fields include `slug`, `category`,
  `description`, `phone`, `email`, `whatsapp`, `instagram`, `address_text`, and
  `onboarding_completed_at`; cross-phase business identity adds optional
  normalized `website` and deterministic `logo_path` references. Binary image
  content is not stored in PostgreSQL.
- `business_members`: VERIFIED.
- `audit_logs`: VERIFIED.
- `customers`: VERIFIED. Phase 4 fields include `id`, `business_id`, `name`,
  `email`, `phone`, `notes`, `archived_at`, `created_at`, and `updated_at`.
- `bookings`: VERIFIED. Phase 5 fields include `id`, `business_id`,
  `customer_id`, immutable generated `reference`, `title`, `description`,
  `currency`, `total_amount_minor`, `deposit_amount_minor`, `scheduled_for`,
  `status`, `internal_notes`, `created_by`, timestamps, `started_at`,
  `ready_at`, `delivered_at`, `cancelled_at`, `completed_at`, and
  `cancellation_reason`.
- `booking_items`: PLANNED.
- `booking_status_history`: VERIFIED. Rows are written by database trigger
  for booking creation and status transitions; browser clients have read-only
  access through tenant RLS.
- `booking_changes`: VERIFIED. Phase 7 records reschedules with previous/new
  schedule. Phase B also records each applied amendment with `amendment_id`,
  immutable old/new terms, and changed fields. Browser clients can read tenant
  rows but cannot write or mutate them directly.
- `booking_amendments`: VERIFIED. Stores tenant/booking ownership, pending/
  confirmed/revoked status, purpose-specific token hash and expiry, reason,
  base/proposed/effective hashes, immutable old/proposed/effective JSON terms,
  changed fields, frozen confirmation contact, proposer, open/submission/
  confirmation/revocation timestamps, and revocation reason. A partial unique
  index permits at most one pending amendment per booking.
- `booking_addons`: VERIFIED. Stores tenant/parent ownership, creator, title,
  description, inherited currency, integer minor-unit total/deposit, minimal
  state, frozen terms snapshot/hash, confirmation contact, and lifecycle
  timestamps. Parent/business/currency consistency is trigger-enforced; a
  partial unique index permits at most one awaiting add-on per booking.
- `booking_addon_confirmation_links`: VERIFIED. Stores add-on/booking/business
  ownership, purpose, SHA-256 token hash, expiry, first-open, use, revocation,
  creator, and timestamps. Raw tokens are never stored and one open link is
  allowed per add-on.
- `confirmation_links`: VERIFIED. Phase 6 fields include `id`, `business_id`,
  `booking_id`, `token_hash`, `purpose`, `expires_at`, `used_at`,
  `revoked_at`, `revoked_reason`, `created_by`, and `created_at`. Raw tokens
  are not stored.
- `booking_confirmations`: VERIFIED. Phase 6 stores immutable confirmation
  evidence with `business_id`, `booking_id`, `confirmation_link_id`,
  `terms_hash`, `terms_snapshot`, `contact_email`, optional `contact_phone`, and
  `confirmed_at`. Contact fields preserve what the customer submitted for that
  confirmation even if the customer record changes later.
- `confirmation_rate_limits`: VERIFIED. Phase 6 stores hashed public endpoint
  rate-limit buckets without raw IP addresses.
- `feedback_links`: VERIFIED. Phase 8 fields include `id`, `business_id`,
  `booking_id`, `token_hash`, `purpose`, `expires_at`, `used_at`,
  `first_opened_at`, `revoked_at`, `revoked_reason`, `created_by`, and
  `created_at`. Raw feedback tokens are not stored.
- `feedback`: VERIFIED. Phase 8 fields include `id`, `business_id`,
  `booking_id`, `customer_id`, `feedback_link_id`, `overall_rating`,
  `on_time`, `met_expectations`, optional `comment`, `submitted_at`, and
  `created_at`. Feedback is immutable after insert.
- `booking_issues`: VERIFIED. Phase 8 fields include `id`, `business_id`,
  `booking_id`, `category`, `description`, `status`, `created_by`,
  `created_at`, `resolved_by`, and `resolved_at`.
- `analytics`: VERIFIED as derived aggregate output from existing tenant-owned
  records through `public.get_business_insights`. There are no persistent
  analytics records in Phase 9.
- `subscriptions`: PLANNED.
- `subscription_events`: PLANNED.
- `email_events`: VERIFIED for `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`,
  `BOOKING_AMENDMENT_REQUESTED`, `BOOKING_AMENDMENT_CONFIRMED`,
  `BOOKING_ADDON_REQUESTED`, `BOOKING_ADDON_CONFIRMED`, `BOOKING_RESCHEDULED`,
  and `BOOKING_DELIVERED`. Events are private,
  tenant-related durable outbox rows with recipient, status, attempt metadata,
  provider message ID, and bounded safe failure fields. Domain-specific unique
  keys allow one logical event per confirmation, amendment, add-on link, or
  confirmed add-on as appropriate.
  Reschedule events reference the exact `booking_change_id` and replacement
  `confirmation_link_id` through composite tenant/booking foreign keys and
  partial unique indexes. Delivery events reference immutable booking
  confirmation evidence. These nullable associations add no browser table grant.

## Expected Relationships

```text
Business
+-- BusinessMembers
+-- Customers
+-- Bookings
|   +-- BookingItems
|   +-- BookingStatusHistory
|   +-- BookingChanges
|   +-- BookingAmendments
|   +-- BookingAddons
|   |   +-- BookingAddonConfirmationLinks
|   +-- ConfirmationLinks
|   +-- BookingConfirmations
|   +-- EmailEvents
|   +-- FeedbackLinks
|   +-- Feedback
|   +-- BookingIssues
+-- Subscription
```

## Multi-Tenancy Principle

Business data must be tenant scoped.

Future tenant-owned records should generally contain an appropriate `business_id` relationship. A user belonging only to Business A must never gain access to Business B data.

Frontend filtering is not sufficient authorization. The eventual database and server layers must enforce tenant boundaries.

## Entity Notes

Profiles represent authenticated platform users. They are not customers by default.

Businesses represent tenants.

Business members connect platform users to businesses and future staff roles.

Business onboarding creates a business and the owner membership atomically.
Memberships remain authoritative for current-business resolution; user metadata
and profile fields are not used as tenant authority.

Customers are business-owned records and do not normally authenticate into My
Customers. Each customer belongs to exactly one business through `business_id`.
Phase 4 uses `archived_at` for ordinary archive behavior instead of hard
deletion.

Bookings are the central operational records and belong to a business and
customer. Phase 5 stores `bookings.business_id` directly and enforces
`booking.business_id == customer.business_id` with a composite foreign key to
`customers (business_id, id)`. Booking `business_id`, `customer_id`,
`reference`, and `created_by` are immutable after creation.

Booking creation for both customer modes uses
`public.create_booking_with_customer`. Existing mode requires an active
same-business `customer_id` and rejects new-customer fields. New mode rejects a
customer ID, requires a normalized customer name, accepts optional normalized
email/phone, and commits customer, booking, status history, and audit effects in
one transaction. Archived customers are neither returned by the picker nor
accepted by the creation RPC; restoration remains a separate future workflow.

Booking references are human-readable identifiers generated by the database.
They are not secrets and must not be used as authorization credentials.

Booking money is stored as integer minor units. `total_amount_minor` and
`deposit_amount_minor` are constrained to nonnegative values, and deposit cannot
exceed total. These are agreed terms, not a mutable cash balance.

Booking currency is explicit and constrained to `NGN`, `EUR`, `GBP`, or `USD`.
Phase 5 performs no currency conversion.

Current agreed value is the canonical booking total plus all `CONFIRMED` add-on
totals. Recorded paid is the canonical booking deposit plus all `CONFIRMED`
add-on deposits plus append-only `booking_payments`. Outstanding is the
nonnegative difference between effective total and recorded paid. Draft,
awaiting-customer, and cancelled add-ons contribute zero; amendments contribute
through the canonical booking exactly once after confirmation. A confirmed
add-on remains immutable evidence after parent cancellation, while cancelled
bookings are excluded from recorded/completed analytics according to
`docs/ANALYTICS_DEFINITIONS.md`.

Booking status is constrained to `DRAFT`, `AWAITING_CUSTOMER`, `CONFIRMED`,
`IN_PROGRESS`, `READY`, `DELIVERED`, `COMPLETED`, or `CANCELLED`. Valid
transitions are enforced by a database trigger. `DRAFT` bookings can move to
`AWAITING_CUSTOMER` when a confirmation link is generated. Customer confirmation
through a valid link records `AWAITING_CUSTOMER -> CONFIRMED -> IN_PROGRESS`
atomically. Authenticated
vendor lifecycle transitions after confirmation use
`public.transition_booking_status`, not direct browser table updates. The
verified Phase 7 graph is:

```text
DRAFT -> AWAITING_CUSTOMER
DRAFT -> CANCELLED
AWAITING_CUSTOMER -> CONFIRMED by valid customer confirmation link
AWAITING_CUSTOMER -> CANCELLED
CONFIRMED -> AWAITING_CUSTOMER by explicit reschedule
CONFIRMED -> IN_PROGRESS
CONFIRMED -> CANCELLED
IN_PROGRESS -> READY
IN_PROGRESS -> CANCELLED
READY -> DELIVERED
READY -> CANCELLED
DELIVERED -> COMPLETED
```

`COMPLETED` and `CANCELLED` are terminal and lock further booking edits.
Operational timestamps are set by database-controlled transitions rather than
accepted from browser clients.

`booking_payments` has a composite tenant/booking foreign key, positive safe
minor-unit amount, actor and timestamps, and a unique per-booking operation ID.
Authenticated members may select same-tenant rows but cannot directly insert,
update, or delete. The narrow locked RPC derives business, actor, currency,
lifecycle, and outstanding server-side and commits the row with safe audit
evidence. `DELIVERED -> COMPLETED` uses the same authoritative totals and is
denied while outstanding is positive.

Customer confirmation stores current terms on `bookings` in
`customer_confirmed_at`, `confirmation_terms_hash`, and
`confirmation_terms_snapshot`. Direct material changes to confirmed booking
terms are denied. The material set is customer, title, customer-facing
description, currency, total, deposit, and schedule. Non-material internal
notes do not invalidate confirmation.

Booking reschedules before fulfilment use `public.reschedule_booking`.
Rescheduling a confirmed booking is a material change: it clears the current
confirmation fields, revokes open confirmation links, records a
`booking_changes` row, and requires a new customer confirmation before work
continues.

General amendments use `public.create_booking_amendment` and do not update the
booking. Only `CONFIRMED` and `IN_PROGRESS` bookings qualify. The proposal is
based on `bookings.confirmation_terms_hash`; customer confirmation through
`public.confirm_booking_amendment_by_token_hash` locks both rows, compares the
base hash, enables the transaction-scoped amendment exception in the integrity
trigger, applies the structured proposal, updates the current effective snapshot
and hash, writes one amendment `booking_changes` row/audit/email event, and marks
the amendment confirmed. Original booking-confirmation rows are not rewritten.

Schedule-only explicit reschedule remains the established pre-work workflow and
returns a confirmed booking to `AWAITING_CUSTOMER` for ordinary confirmation.
It revokes a pending general amendment so the two paths cannot conflict.

Confirmed/later cancellation requires a bounded plain-text reason where the
existing transition graph permits cancellation. The transaction preserves
`booking_confirmations`, confirmed timestamps, terms snapshot/hash, contact
evidence, and trigger-owned history. It inserts at most one
`BOOKING_CANCELLED` email event for the latest confirmation. Recipient selection
prefers `booking_confirmations.contact_email`; only legacy evidence without a
contact may fall back to `customers.email`. Draft/awaiting cancellations do not
create customer email events because no current customer agreement exists.

Booking add-ons are linked new-scope records rather than edits to original or
amendment evidence. `public.create_booking_addon` derives parent ownership and
currency from the eligible booking. `public.submit_booking_addon` freezes
structured terms and current confirmation contact while leaving the booking
unchanged. `public.confirm_booking_addon_by_token_hash` atomically locks the
link, add-on, and parent; verifies purpose, expiry, lifecycle, and state; marks
the add-on confirmed; consumes the link; and creates one audit/outbox effect.

Only confirmed add-ons contribute to derived effective booking totals and
analytics. Draft, awaiting, and cancelled add-ons contribute zero. Multiple
confirmed add-ons sum onto the current canonical booking terms, while booking
count remains one. V1 stores no add-on schedule because all add-ons share the
parent's current delivery. Catalog semantics, inventory coupling, separate
fulfilment, and confirmed add-on correction/cancellation remain deferred.

Confirmation links are scoped access mechanisms for customer-facing booking
actions. Phase 6 stores only SHA-256 token hashes, enforces one open link per
booking, supports revocation and regeneration, expires links by database time,
and treats public GET views as non-consuming. Consumed links keep serving the
immutable confirmation snapshot instead of current mutable booking terms.

Feedback links are scoped access mechanisms for completed-booking private
feedback. Phase 8 stores only SHA-256 token hashes, uses a dedicated
`booking_feedback` purpose, enforces one open link per booking, supports
revocation/regeneration, expires links by database time, and treats public GET
views as non-consuming. Feedback links are separate from confirmation links and
wrong-purpose tokens are denied.

Feedback is a private, immutable business record attached to one completed
booking, one tenant customer, and one consumed feedback link. Customers submit
rating, on-time, expectations, and optional plain text comments through the
public token flow. Feedback is not a public review and is visible only to active
members of the owning business.

Booking issues are internal operational records attached to bookings. Vendors
can create open issues and resolve them once. Issue descriptions remain
tenant-private and are not exposed on public customer-facing token pages.

Analytics are derived from customer, booking, feedback, and issue records that
already belong to a business. Phase 9 calculates aggregate JSON inside
PostgreSQL through a membership-checked RPC. Value aggregates are grouped by
booking currency; mixed-currency totals are not stored or returned.

Subscriptions represent vendor subscription billing for My Kustomers, not payments between vendors and their customers.

## Multi-Business Membership And Selection

One auth user may have zero, one, or many `business_members` rows. The active
membership set is the authorization source; `profiles` deliberately has no
`business_id`. Current-business preference is stored outside the relational
model in an HTTP-only application cookie and is accepted only when it matches an
active membership visible to that user. Role is read from the selected
membership, so one account may be an owner in one business and a member in
another.

Migration `20260824094523_select_current_business_for_booking_creation.sql`
changes `create_booking_with_customer` to require `p_business_id` and verifies
an exact active membership before any customer or booking write. This prevents
the transaction from inferring an unrelated first membership.

## Platform Administration

`platform_admins`: VERIFIED IN PRODUCTION. One row per Auth user, with
`SUPER_ADMIN`, `ACTIVE`/`DISABLED`, creation/update provenance, timestamps, RLS,
no browser table grants, and an active-caller-only RPC. It has no `business_id`
and does not derive authority from `business_members`. The user UUID primary key
is the only index required for the current lookup contract. Production currently
has exactly one active administrator.

`get_platform_admin_overview()`: read-only Phase 2 aggregate boundary. It returns
one JSON object of non-negative counts and a server timestamp after verifying the
authenticated caller is an active `SUPER_ADMIN`. Counts derive from
`businesses`, `profiles`, `customers`, `bookings`, `booking_issues`, and
`email_events`; no row identifiers, identity fields, contact data, booking terms,
or monetary values are returned.

Admin Phase 3 adds no domain tables. Migration
`20260825003219_platform_admin_read_only_directories.sql` adds four read-only
JSON projections: paginated business summaries, one business detail, paginated
safe Auth user summaries, and one safe Auth user detail. A private helper checks
`auth.uid()` against an `ACTIVE SUPER_ADMIN` before every privileged read.
Functions are postgres-owned, use an empty search path and fully qualified
relations, revoke PUBLIC/anonymous execution, and grant authenticated execution
only behind the internal authority check. `auth.users` and `auth.identities`
remain inaccessible as tables; projections allowlist email, account timestamps,
and provider names and omit raw metadata, identity payloads, sessions, and
tokens. No search index is added at current volume; trigram indexing requires a
measured future plan regression before adoption.

Admin Phase 4 adds no tables, columns, indexes, triggers, or domain mutations.
Forward migration `20260825022135_platform_admin_read_only_booking_issue_operations.sql`
defines four read-only JSON projections for booking list/detail and issue
list/detail. Each invokes the existing private active-admin assertion before
reading. Booking pages count booking rows once and compute effective totals from
the canonical booking plus `CONFIRMED` add-ons only. Booking detail exposes
allowlisted lifecycle evidence; issue description exists only in the issue
detail projection. Contact evidence is masked and raw terms/hashes, private
feedback comments, internal notes, recipient/provider/failure payloads are not
projected. The migration is applied to the production-backed project; all four
functions are postgres-owned, stable, `SECURITY DEFINER`, use an empty search
path, deny anonymous invocation, and recheck active admin authority internally.

Admin Phase 5 adds no tables, columns, enums, policies, triggers, indexes, or
domain data changes. Forward migration
`20260825095217_platform_admin_read_only_email_operations.sql` defines a private
failure-code classifier and two public read-only JSON RPCs. The directory RPC
joins existing non-null `email_events.business_id` and `booking_id` relations,
returns a bounded status summary and newest-first page, and omits recipient and
failure fields. The detail RPC returns the existing masked recipient and one
allowlisted failure category only. Raw failure text, provider message IDs,
customer IDs, content, and tokens never enter either DTO. The migration is
applied transactionally to the production-backed project. The outbox remained
at eight rows and the sole active `SUPER_ADMIN` remained one across application.

Admin Phase 6B adds `email_delivery_attempts` as append-only evidence scoped to
one logical `email_events` row. `(email_event_id, attempt_number)` is unique.
Each attempt records its pinned provider, `DOMAIN_EVENT` or `ADMIN_RETRY` origin,
safe requested-by/reason evidence for admin retries, status, bounded result, and
timestamps. Prior attempts are never rewritten when a later attempt begins.

Normal delivery can claim only `PENDING`. Manual retry locks a matching `FAILED`
event and latest failed attempt, verifies exact count/code/provider and current
active super-admin, increments the logical attempt count, and appends one
`SENDING` retry attempt. Finalization atomically reconciles attempt and event to
`SENT` or `FAILED`. Browser roles have no table access and cannot invoke the
mutation RPCs. Booking, customer, confirmation, amendment, add-on, and feedback
rows are outside this communication-only transition.

## Admin Phase 7 Read Model

Admin Phase 7 adds no table, column, enum, index, row mutation, or retained
health record. Migration
`20260826195655_admin_phase_7_security_health.sql` adds two read-only JSON RPCs:
`get_platform_admin_health_summary()` and
`get_platform_admin_security_activity(integer)`. They aggregate existing
`email_events`, `email_delivery_attempts`, `booking_issues`, `bookings`,
`platform_admins`, `audit_logs`, `profiles`, and `auth.users` evidence through a
strict minimized DTO. The activity query limits source rows before actor joins;
no audit array is embedded in the health summary.
