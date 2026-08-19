# Architecture

Detailed accepted decisions are recorded in `docs/DECISIONS.md`. This document
summarizes the current architecture and must not be used to silently override an
accepted ADR.

Documentation is not implementation evidence. Planned architecture must be
distinguished from implemented code and verified behavior.

My Customers is a modular monolith. The product should remain one deployable
Next.js application until there is concrete operational pressure to split a
module out. Microservices are intentionally avoided because Phase 1 does not
have independent scaling, ownership, or deployment needs that would justify the
coordination cost.

## Application Structure

The app uses Next.js App Router route groups:

- `(public)` for public product pages.
- `(auth)` for authentication routes.
- `(dashboard)` for the authenticated vendor workspace.
- `api` for server route handlers.
- `/c/[token]` for public customer booking confirmation links.
- `/f/[token]` for public private-feedback links.

Feature folders hold domain code for auth, businesses, customers, bookings,
confirmation links, feedback, analytics, billing, and settings. Shared UI
primitives live in `components/ui`; shared composition belongs in
`components/layout`, `components/forms`, or `components/shared` only when reuse
is real.

## Supabase Architecture

Supabase Auth and the initial tenant schema are implemented in Phase 2. Business
onboarding, customer management, booking management, secure confirmation links,
operational booking lifecycle controls, private feedback, and internal booking
issues extend that schema with tenant-owned records, RLS policies, database
constraints, narrow RPCs, and focused runtime security tests. Client
construction lives in `lib/supabase`, using browser, server, proxy, and
server-only service-role helpers separately so secrets do not cross into client
bundles.

## Multi-Tenancy

Platform users authenticate with Supabase Auth and belong to one or more
business tenants through `business_members`. Customers are business records and
usually will not have platform accounts. Bookings belong to both a business and
a tenant-owned customer, with database-level consistency between those
relationships. Confirmation links are scoped public capabilities for individual
booking actions and store only token hashes. Vendor operational status changes
use controlled authenticated Supabase RPCs and database trigger enforcement
instead of direct browser-supplied status writes. Feedback links are separate
scoped public capabilities for completed-booking feedback and store only token
hashes. Operational issues are internal tenant records and are not exposed on
public customer-facing pages. Tenant-owned tables must include a business
ownership model and PostgreSQL RLS policies that enforce row access server-side.

## Server and Client Boundaries

Server-only environment values live behind `lib/config/server-env.ts`, which
imports `server-only`. Client-safe values use the `NEXT_PUBLIC_` prefix and are
validated separately. UI components should not directly perform database access;
server actions, route handlers, or feature-level server modules should own data
access.

## Testing Strategy

Vitest covers shared utilities, domain validation, static migration/security
checks, and opt-in runtime Supabase tenant tests. Playwright covers browser
journeys for auth, onboarding, customers, bookings, customer confirmation, and
the operational booking lifecycle, private feedback, and internal issue
resolution.

## Architecture Conflict Handling

Codex may implement accepted decisions, identify problems, recommend
improvements, flag conflicts, and suggest alternatives. Codex must not silently
replace accepted architecture decisions.

For significant conflicts, report:

```text
ARCHITECTURE CONFLICT
```

Then explain the accepted decision, conflict discovered, why it matters,
recommended alternatives, and impact of each alternative.
