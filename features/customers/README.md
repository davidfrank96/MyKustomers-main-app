# Customers Feature

Phase 4 implements tenant-scoped customer records for businesses.

Customers are business-owned records, not platform accounts. They are not
Supabase Auth users, do not have passwords, and are not members of
`business_members`.

Customer access is controlled by the `customers.business_id` relationship,
server-side membership checks, and PostgreSQL RLS. Archive remains the ordinary
removal action and is reversible through Restore. Archive never changes a
booking, including an active booking.

Permanent deletion is an exceptional owner-only action. It is shown only for a
customer with no known booking history and is rechecked atomically by
`public.delete_customer_if_eligible`. The function locks the customer, verifies
current owner authority and tenant scope, and refuses deletion when any booking
or protected dependency exists. It never cascades to bookings. Members can
archive and restore but cannot permanently delete. Booking-query failures fail
closed in the UI, and database eligibility remains authoritative against races.

Customer rows expose Archive/Restore and eligible Delete through a visible
desktop/keyboard action menu. A lightweight mobile horizontal swipe may reveal
the same actions but never executes one; vertical movement and the left-edge
browser navigation gesture retain priority. Permanent deletion always requires
an explicit destructive confirmation.

The Customers list remains a server-rendered, tenant-scoped search over name,
email, and phone. Its text input updates the `q` URL parameter from the first
character after a shared 300 ms debounce. Replace-style navigation preserves the
active/archived/all filter without adding one browser-history entry per
character, while each query change restarts the server-rendered 25-row list.
Clearing removes `q` automatically, and archive-filter links preserve compatible
search state. Load more appends an authenticated, current-business-derived
25-row batch using deterministic `(created_at, id)` ordering; concurrent clicks,
duplicates, stale query state, and cross-business accumulation are blocked.

A vendor may create a real customer inline from New Booking with required name
and optional email/phone. Creation is part of the same authenticated database
transaction as the booking and records the ordinary `CUSTOMER_CREATED` audit.
Exact active-customer name, normalized email, or phone matches produce a
non-blocking warning; they are never silently merged. Archived customers are
excluded from booking search/selection and cannot be attached to a new booking.

`customers.email` is optional saved contact data entered deliberately by the
vendor. Secure booking confirmation never writes that field, including when it
is empty. Optional phone enrichment remains independent. The submitted email is
immutable booking evidence on `booking_confirmations`; it is not described as
verified contact ownership.

Repeat bookings may therefore retain different booking contacts for the same
customer without changing or duplicating the customer directory record. The
booking UI keeps the communication field blank until the vendor types an email
or explicitly chooses **Use saved email**. No
preferred contact, customer email history, ownership verification, or automatic
deduplication model exists in this detour.

Customer-contact email normalization trims surrounding whitespace, preserves
the mailbox/local part exactly, and lowercases only the domain. It does not use
a provider allowlist; syntactically supported Gmail, Outlook/Hotmail, Yahoo,
iCloud, country-code, and custom domains follow the same validation policy.
