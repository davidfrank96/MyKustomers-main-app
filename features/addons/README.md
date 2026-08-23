# Booking Add-ons Feature

Phase C owns linked new scope on an existing customer-confirmed booking.

## Domain Rules

- An add-on is new scope; an amendment changes existing scope.
- Eligible parent statuses are `CONFIRMED` and `IN_PROGRESS`.
- V1 add-ons inherit parent currency and current delivery schedule.
- Money is stored as safe integer minor units with deposit no greater than total.
- `DRAFT`, `AWAITING_CUSTOMER`, and `CANCELLED` add-ons do not affect totals.
- Every `CONFIRMED` add-on contributes to derived current value, deposit, and
  balance without increasing booking count.
- Confirmed add-ons and their structured terms snapshot/hash are immutable.
- One add-on may await customer confirmation per booking and never alongside a
  pending amendment.
- Reschedule, parent cancellation, and advancement to `READY` cancel pending
  add-ons and revoke open links. Confirmed evidence remains.
- Separate delivery or fulfilment requires a new booking.

## Security Boundary

Vendor create/submit/cancel actions use membership-checked RPCs. Public
`/x/[token]` handlers hash the distinct 32-byte capability before service-only,
rate-limited view/open/confirm RPCs. Only token hashes are stored; add-on,
original confirmation, amendment, and feedback purposes are not interchangeable.

RLS permits tenant-scoped authenticated reads only. Direct authenticated writes
and all anonymous table access are denied. Parent business/currency consistency
and confirmed immutability are database-triggered.

## Deferred

Confirmed add-on correction/cancellation, customer rejection/chat, independent
delivery, catalog/inventory, payment processing, and billing.
