# Data Model

STATUS: PLANNED AND PARTIALLY IMPLEMENTED

This document describes the planned conceptual data model and current migration evidence. Documentation is not implementation evidence.

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

Customer contact and confirmation-email foundation migration evidence exists at
`supabase/migrations/20260820131919_customer_contact_confirmation_email_foundation.sql`.
It adds immutable confirmation contact fields and the private durable
`email_events` outbox, replaces the confirmation RPC so contact capture and
event creation are atomic, and adds a service-role-only event claim RPC. It was
applied to the configured development Supabase database and runtime-verified.

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
  `onboarding_completed_at`.
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
- `booking_changes`: VERIFIED. Phase 7 records focused operational change
  history for reschedules with previous/new scheduled times, changer, and
  tenant-owned booking relationship. Browser clients can read tenant rows but
  cannot write or mutate them directly.
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
  `revoked_at`, `revoked_reason`, `created_by`, and `created_at`. Raw feedback
  tokens are not stored.
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
- `email_events`: VERIFIED for `BOOKING_CONFIRMED`. Events are private,
  tenant-related durable outbox rows with recipient, status, attempt metadata,
  provider message ID, and bounded safe failure fields. One event is allowed per
  booking confirmation.

## Expected Relationships

```text
Business
+-- BusinessMembers
+-- Customers
+-- Bookings
|   +-- BookingItems
|   +-- BookingStatusHistory
|   +-- BookingChanges
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

Booking references are human-readable identifiers generated by the database.
They are not secrets and must not be used as authorization credentials.

Booking money is stored as integer minor units. `total_amount_minor` and
`deposit_amount_minor` are constrained to nonnegative values, and deposit cannot
exceed total. Balance is derived as `total_amount_minor - deposit_amount_minor`
and is not stored.

Booking currency is explicit and constrained to `NGN`, `EUR`, `GBP`, or `USD`.
Phase 5 performs no currency conversion.

Booking status is constrained to `DRAFT`, `AWAITING_CUSTOMER`, `CONFIRMED`,
`IN_PROGRESS`, `READY`, `DELIVERED`, `COMPLETED`, or `CANCELLED`. Valid
transitions are enforced by a database trigger. `DRAFT` bookings can move to
`AWAITING_CUSTOMER` when a confirmation link is generated. Customer confirmation
through a valid link moves `AWAITING_CUSTOMER` to `CONFIRMED`. Authenticated
vendor lifecycle transitions after confirmation use
`public.transition_booking_status`, not direct browser table updates. The
verified Phase 7 graph is:

```text
DRAFT -> AWAITING_CUSTOMER
DRAFT -> CANCELLED
AWAITING_CUSTOMER -> CONFIRMED by valid customer confirmation link
AWAITING_CUSTOMER -> CANCELLED
CONFIRMED -> AWAITING_CUSTOMER by material edit or reschedule
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

Customer confirmation stores current terms on `bookings` in
`customer_confirmed_at`, `confirmation_terms_hash`, and
`confirmation_terms_snapshot`. Material changes to confirmed booking terms clear
the current confirmation fields and return the booking to `AWAITING_CUSTOMER`;
non-material internal notes do not invalidate confirmation.

Booking reschedules before fulfilment use `public.reschedule_booking`.
Rescheduling a confirmed booking is a material change: it clears the current
confirmation fields, revokes open confirmation links, records a
`booking_changes` row, and requires a new customer confirmation before work
continues.

Booking items remain planned. Phase 5 deliberately avoids adding line items,
catalog semantics, inventory coupling, or item-level totals before the product
requires them.

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

Subscriptions represent vendor subscription billing for My Customers, not payments between vendors and their customers.
