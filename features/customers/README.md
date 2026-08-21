# Customers Feature

Phase 4 implements tenant-scoped customer records for businesses.

Customers are business-owned records, not platform accounts. They are not
Supabase Auth users, do not have passwords, and are not members of
`business_members`.

Customer access is controlled by the `customers.business_id` relationship,
server-side membership checks, and PostgreSQL RLS. Ordinary UI deletion is
implemented as archiving through `archived_at`; hard deletion is deferred to a
future privacy/account-deletion design.

A vendor may create a real customer inline from New Booking with required name
and optional email/phone. Creation is part of the same authenticated database
transaction as the booking and records the ordinary `CUSTOMER_CREATED` audit.
Exact active-customer name, normalized email, or phone matches produce a
non-blocking warning; they are never silently merged. Archived customers are
excluded from booking search/selection and cannot be attached to a new booking.

Secure booking confirmation may conservatively enrich a customer's empty email
or phone from customer-provided contact. Existing non-empty values are
preserved, even when the submitted booking contact differs. The submitted value
remains immutable evidence on `booking_confirmations`; it is not described as
verified contact ownership.
