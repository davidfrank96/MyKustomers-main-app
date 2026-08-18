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
