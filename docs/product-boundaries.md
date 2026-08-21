# Product Boundaries

Documentation is not implementation evidence. This document defines scope; it
does not imply scoped features already exist.

V1 is focused on:

- customers;
- bookings/orders;
- confirmations;
- order lifecycle;
- private feedback;
- business insights.

V1 is not intended to become:

- an ecommerce marketplace;
- a payment processor for customer transactions;
- an inventory management platform;
- a payroll application;
- an accounting platform;
- a delivery logistics platform;
- a public review marketplace;
- a social network;
- an enterprise CRM;
- a POS platform.

These boundaries protect the product from feature creep. Later phases should
reject work that expands the product outside this scope unless the product
strategy is explicitly revised.

Future proposals must justify movement toward any excluded area. Vendor
subscription billing is separate from payments between a vendor and their
customer.

## Current Deferred Boundaries

- Vendor subscription billing and subscription enforcement.
- Customer-to-vendor payment processing.
- Automatic lifecycle emails beyond the booking-confirmed outbox foundation.
- A production retry worker, scheduled delivery, and bounce handling.
- Sophisticated customer merge/deduplication.
- A server-paginated customer picker for very large customer lists.
- Customer phone or email ownership verification.
- The broad page-by-page visual redesign and final visual identity.
- Staff invitation and role-management workflows.
