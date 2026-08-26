# Customers Feature

Phase 4 implements tenant-scoped customer records for businesses.

Customers are business-owned records, not platform accounts. They are not
Supabase Auth users, do not have passwords, and are not members of
`business_members`.

Customer access is controlled by the `customers.business_id` relationship,
server-side membership checks, and PostgreSQL RLS. Ordinary UI deletion is
implemented as archiving through `archived_at`; hard deletion is deferred to a
future privacy/account-deletion design.

The Customers list remains a server-rendered, tenant-scoped search over name,
email, and phone. Its text input updates the `q` URL parameter from the first
character after a shared 300 ms debounce. Replace-style navigation preserves the
active/archived/all filter and list limit without adding one browser-history
entry per character, while each query change removes `page` so results restart
at page 1. Clearing removes `q` automatically, and archive-filter and pagination
links preserve compatible search state.

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

Repeat bookings may therefore retain different booking contacts for the same
customer without changing or duplicating the customer directory record. No
preferred contact, customer email history, ownership verification, or automatic
deduplication model exists in this detour.
