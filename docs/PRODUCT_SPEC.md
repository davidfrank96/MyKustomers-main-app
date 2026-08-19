# Product Specification

## Status

STATUS: PLANNED

This document describes product intent and domain concepts. It is not implementation evidence.

## Product Summary

My Customers helps small businesses turn informal customer conversations into organised business records.

The platform is not replacing WhatsApp, Instagram, phone calls, or direct messages. It captures the structured agreement after the vendor and customer have reached an agreement externally.

## Core Actors

### Platform User

An authenticated My Customers user.

Examples:

- Business owner.
- Staff member.
- Future platform administrator.

### Business

A tenant within My Customers.

A platform user may eventually belong to one or more businesses. Do not assume one-user-one-business unless a later accepted decision explicitly does so.

### Customer

A customer belongs to a business.

A customer is not normally an authenticated My Customers user. Customer records may contain name, phone, email, customer history, and related bookings.

### Booking

The booking/order is the central business domain object.

Conceptual relationship:

```text
Customer
    |
    v
Booking
    |
    v
Confirmation
    |
    v
Fulfilment
    |
    v
Completion
    |
    v
Feedback
    |
    v
Analytics
```

## Booking Philosophy

The vendor creates the booking. The customer does not independently define the agreed booking terms inside My Customers.

Conceptual workflow:

```text
Vendor and customer agree externally
        |
        v
Vendor creates booking
        |
        v
Vendor sends confirmation link
        |
        v
Customer reviews
        |
        v
Customer confirms
        |
        v
Booking becomes operational
```

Material booking changes after customer confirmation must be handled explicitly and must not silently replace the terms originally confirmed.

Phase 6 implements the first customer confirmation workflow. Vendors generate a
secure link for an eligible booking, the customer reviews a minimized public
booking view without an account, and confirmation moves the booking from
`AWAITING_CUSTOMER` to `CONFIRMED`. Material changes after confirmation require
a new customer confirmation; internal notes are private vendor data and do not
affect confirmed terms.

Phase 7 implements the first operational fulfilment workflow. After customer
confirmation, the vendor can start work, mark the booking ready, mark it
delivered, and complete it. Vendors can cancel active operational bookings with
a reason. Vendors can reschedule before fulfilment begins; rescheduling a
confirmed booking requires customer reconfirmation.

Phase 8 implements the first private feedback and operational issue workflow.
After a booking is completed, the vendor can generate a secure feedback link.
The customer can submit private feedback without an account, and that feedback
is visible only to the owning business. Vendors can also record and resolve
internal operational issues on bookings. Feedback is not public review content,
and issues are not customer-facing support tickets.

Phase 9 implements private business insights derived from stored customer,
booking, feedback, and issue records. Insights are deterministic,
tenant-scoped, and intended to help the vendor understand operational activity.
Financially-related metrics use recorded booking value and completed booking
value terminology, not revenue, cash, profit, tax, or accounting claims.
Currency values are grouped by currency and never converted or summed across
currencies.

## Customer Experience Principle

Customer-facing flows should generally:

- Require no My Customers account.
- Open directly in the browser.
- Be mobile optimized.
- Expose only data required for the specific booking.
- Use secure temporary or scoped access mechanisms.

The customer should not be forced to install an application.

## Current Exclusions

V1 does not process payment between a vendor and their customer. Vendor subscription billing is separate and belongs to a later phase.
