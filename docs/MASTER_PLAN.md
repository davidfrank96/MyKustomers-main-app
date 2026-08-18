# Master Plan

## Governance Status

Documentation uses these status labels strictly:

- PLANNED: Specified direction, not necessarily present in code.
- IMPLEMENTED: Code, configuration, migration, policy, or infrastructure exists.
- VERIFIED: Implementation has been inspected and successfully tested through an appropriate verification method.

Documentation is not implementation evidence. Future work must inspect repository evidence before reporting anything as implemented, and must run or inspect an appropriate verification mechanism before reporting anything as verified.

## Product

My Customers

## Product Vision

My Customers is a mobile-first SaaS platform for small businesses and SMEs that commonly manage customer orders through informal channels such as WhatsApp, Instagram, phone calls, social media, referrals, and direct messages.

It converts informal customer agreements into structured business records.

Businesses will eventually be able to manage customers, manage bookings/orders, send private booking confirmation links, track fulfilment, track values, deposits, and balances, collect private feedback, view customer history, view business performance, and manage subscriptions.

Customers generally do not create My Customers accounts. They interact with individual bookings through secure customer-facing links.

The platform does not initially process payment between the vendor and their customer.

## Product Positioning

Primary positioning:

> My Customers helps small businesses turn informal customer conversations into organised business records.

Supporting concept:

> You already sell through WhatsApp, Instagram, phone calls, and direct messages. My Customers helps you keep track of what happens after the customer says yes.

The product should remain deliberately lightweight.

## Non-Negotiable Architecture

- Application: Mobile-first web application / PWA.
- Architecture: Modular monolith.
- Frontend: Next.js 16 App Router, React, TypeScript, Tailwind CSS.
- Backend: Next.js server-side application layer.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Authorization: Server-side authorization plus PostgreSQL RLS.
- Storage: Supabase Storage.
- Validation: Zod.
- Transactional email: Resend.
- Testing: Vitest and Playwright.
- Deployment: Vercel initially.
- Native mobile: Not V1.

Accepted decisions are recorded in `docs/DECISIONS.md`.

## Current Project Status

- Phase 0 - Product Definition: VERIFIED.
- Phase 1 - Repository Foundation: VERIFIED.
- Phase 1.5 - Project Governance and Planning: VERIFIED.
- Phase 2 - Authentication and Multi-Tenancy Foundation: IMPLEMENTED - VERIFICATION PENDING.
- Phase 3 - Business Onboarding: VERIFIED.
- Phase 4 - Customer Management: VERIFIED.
- Phase 5 - Booking Engine: VERIFIED.

Phase 1 established a Next.js application foundation, strict TypeScript, responsive shells, design primitives, environment configuration, Supabase client/server boundaries, test infrastructure, PWA foundation, documentation foundation, and lint/build/typecheck/test verification.

## Planned Functionality

The following remain PLANNED and must not be described as implemented until repository evidence exists:

- Customer confirmation.
- Feedback.
- Analytics.
- Subscriptions.
- Staff accounts.
- Email workflows.
- Payment provider abstraction for vendor subscriptions.

Implemented in Phase 2 and runtime verified against the configured development
Supabase database:

- Profiles, businesses, business memberships, and audit log migration.
- Initial RLS policies, grants, helper functions, and tenant isolation behavior.
- Cross-tenant select/mutation denial, membership escalation denial, owner/member
  authorization, profile isolation, anonymous denial, and audit write boundaries.

Implemented in Phase 2 but still verification-pending overall:

- Public signup E2E is blocked by the configured Supabase project's email rate
  limit during Phase 2V and by the absence of a safe default-email inbox during
  Phase 2E.
- Reset-password completion remains partial until recovery email delivery/token
  handling can be exercised end to end.

Implemented and verified in Phase 3:

- Authenticated no-business users are routed into business onboarding.
- Business creation stores name, slug, category, description, contact details,
  address text, and onboarding completion timestamp.
- Business creation and owner membership creation are atomic through a narrow
  authenticated Supabase RPC that derives ownership from `auth.uid()`.
- Current-business resolution uses active memberships as the source of truth.
- Owners can edit the current business profile at `/business`; members cannot
  perform owner-only updates.
- Runtime Supabase tests verify unauthenticated creation denial, duplicate slug
  handling, atomic rollback on invalid input, owner/member authorization, and
  cross-tenant mutation denial.

Implemented and verified in Phase 4:

- Businesses can view, create, edit, search, paginate, open, and archive
  tenant-owned customer records.
- Customer records belong to exactly one business through `customers.business_id`
  and are not Supabase Auth users or business members.
- Customer table RLS allows active business members to read, create, and update
  only customers owned by businesses where they hold active membership.
- Customer business ownership is immutable in Phase 4; ordinary UI deletion is
  archiving through `archived_at`.
- Runtime Supabase tests verify customer tenant matrix, anonymous denial,
  unauthorized create denial, cross-tenant mutation denial, member permissions,
  archived-record protection, and search isolation.

Implemented and verified in Phase 5:

- Businesses can create, list, search, filter, view, edit, and manage
  tenant-owned bookings connected to active tenant-owned customers.
- Bookings store a database-generated immutable human-readable reference,
  explicit currency, integer minor-unit total and deposit values, derived
  balance display, optional scheduled date/time, private internal notes, and
  lifecycle status.
- Booking `business_id`, `customer_id`, `reference`, and `created_by` are
  immutable after creation. Phase 5 keeps customer reassignment out of scope to
  avoid weakening the business/customer invariant.
- Booking lifecycle transitions are constrained to `DRAFT -> CONFIRMED or
  CANCELLED`, `CONFIRMED -> IN_PROGRESS or CANCELLED`, `IN_PROGRESS -> READY or
  CANCELLED`, `READY -> DELIVERED`, and `DELIVERED -> COMPLETED`. `COMPLETED`
  and `CANCELLED` are terminal.
- Booking status history is recorded by database trigger and authenticated
  browser clients cannot insert or mutate history rows directly.
- Booking items are deferred. Phase 5 tracks booking-level title, description,
  value, deposit, balance, schedule, notes, status, and history without adding a
  catalog or line-item model prematurely.
- Runtime Supabase tests verify booking tenant matrix, unauthorized create
  denial, business/customer reassignment denial, invalid finance denial, valid
  and invalid transitions, terminal locks, history fabrication denial, anonymous
  denial, member permissions, and search isolation.
