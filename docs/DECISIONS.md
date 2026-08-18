# Architecture Decisions

Accepted ADRs must not be silently rewritten. If a future implementation discovers that an ADR should change, preserve the original decision history, mark it superseded if appropriate, create a new ADR, explain the reason, and identify migration impact.

For significant architecture conflicts, report:

```text
ARCHITECTURE CONFLICT
```

Include the existing accepted decision, conflict discovered, why it matters, recommended alternatives, and impact of each alternative.

## ADR-001 - Modular Monolith

Status: Accepted

Date: 2026-08-18

Context: My Customers is early-stage and does not yet have operational pressure requiring separately deployed services.

Decision: Use a modular monolith rather than microservices.

Rationale: One deployable application keeps development, authorization, data modeling, and deployment simpler while the product is still forming.

Consequences: Module boundaries must be maintained inside the repository. Splitting services later requires a new ADR.

Revisit conditions: Independent scaling, team ownership, data isolation, or deployment cadence creates clear pressure to split a module.

## ADR-002 - Mobile-First Web/PWA

Status: Accepted

Date: 2026-08-18

Context: Primary users are small-business operators who often work from phones.

Decision: Build My Customers as a responsive web application / PWA first. Native mobile applications are not part of V1.

Rationale: A web/PWA approach reaches mobile and desktop users with one codebase and lower release overhead.

Consequences: Responsive behavior, touch targets, and installability matter from early phases.

Revisit conditions: Native platform capabilities become essential to core workflows.

## ADR-003 - PostgreSQL / Supabase

Status: Accepted

Date: 2026-08-18

Context: The product needs relational tenant-owned records, authentication integration, storage, and RLS.

Decision: Use Supabase PostgreSQL as the primary datastore.

Rationale: PostgreSQL fits customers, bookings, memberships, status history, and analytics. Supabase provides managed Postgres plus platform services.

Consequences: Schema changes must be migration-driven and RLS-aware.

Revisit conditions: Supabase cannot satisfy required security, compliance, operational, or scale needs.

## ADR-004 - Supabase Authentication

Status: Accepted

Date: 2026-08-18

Context: Platform users need authentication and session management.

Decision: Use Supabase Auth for authenticated platform users.

Rationale: It integrates with Supabase PostgreSQL and supports the intended Next.js SSR architecture.

Consequences: Authorization must not rely only on authentication. Tenant membership remains a separate application concern.

Revisit conditions: Auth requirements exceed Supabase Auth capabilities.

## ADR-005 - Customer Identity Model

Status: Accepted

Date: 2026-08-18

Context: Business customers are usually people interacting through informal sales channels.

Decision: Customers are business-owned records and do not normally authenticate into My Customers.

Rationale: Customer-facing flows should stay lightweight and link-based.

Consequences: Customer data requires strong tenant controls and scoped public link access.
Phase 4 implements customers as business-owned records in `public.customers`;
it does not create Supabase Auth accounts, passwords, sessions, or
`business_members` rows for customers.

Revisit conditions: A future product direction requires customer accounts.

## ADR-006 - Booking as Central Domain Object

Status: Accepted

Date: 2026-08-18

Context: The main operational need is converting an informal agreement into a structured record.

Decision: Bookings/orders are the primary operational domain object.

Rationale: Customers, confirmations, fulfilment, feedback, and analytics all revolve around bookings.

Consequences: Booking integrity and lifecycle state definitions must be carefully designed.

Revisit conditions: Product discovery shows another domain object is more central.

## ADR-007 - Customer Transactions Outside Platform

Status: Accepted

Date: 2026-08-18

Context: Initial product scope excludes processing payments between vendors and their customers.

Decision: V1 does not process payment between customer and vendor.

Rationale: The product focuses on operational record keeping, not payment processing.

Consequences: Deposit and balance fields may track agreements, but payment collection is out of scope.

Revisit conditions: Payment processing becomes an accepted product strategy.

## ADR-008 - Vendor Subscription Billing Separate

Status: Accepted

Date: 2026-08-18

Context: My Customers will eventually need subscription billing for vendors.

Decision: My Customers subscription billing is separate from business customer transactions.

Rationale: Platform subscription billing and vendor/customer payments have different responsibilities and risk profiles.

Consequences: Billing provider integration must sit behind a server-side abstraction.

Revisit conditions: Billing model changes materially.

## ADR-009 - Server + RLS Authorization

Status: Accepted

Date: 2026-08-18

Context: Tenant-owned data must be protected against cross-tenant access.

Decision: Tenant authorization must not rely solely on client-side filtering. Use server authorization plus database RLS where appropriate.

Rationale: Frontend visibility is not authorization. Defense in depth is required for Supabase-exposed data.

Consequences: Future schema work must include RLS policy design and tests.

Revisit conditions: Data access architecture changes away from Supabase-exposed tenant data.

## ADR-010 - Customers Use Secure Web Links

Status: Accepted

Date: 2026-08-18

Context: Customers should not need My Customers accounts for booking confirmation or feedback.

Decision: Customer booking confirmation and feedback interactions use scoped web links rather than requiring customer accounts.

Rationale: This matches the lightweight customer experience and informal sales channels.

Consequences: Tokens must be scoped, expiring, revocable, and protected against abuse.

Revisit conditions: Customer account functionality becomes a deliberate product goal.

## ADR-011 - Business Membership Role Representation

Status: Accepted

Date: 2026-08-18

Context: Phase 2 needs a minimal role model for tenant authorization without building staff management.

Decision: Represent membership roles as a PostgreSQL enum with `owner` and `member`.

Rationale: The enum constrains stored values and keeps Phase 2 intentionally small.

Consequences: New roles require a migration and product decision.

Revisit conditions: Staff permissions require more granular roles.

## ADR-012 - Profile Provisioning Mechanism

Status: Accepted

Date: 2026-08-18

Context: Every authenticated Supabase user should have an application profile.

Decision: Provision profiles with a minimal Auth `auth.users` insert trigger that inserts `profiles` and a signup audit event.

Rationale: This keeps profile lifecycle close to identity creation without adding business onboarding logic to the trigger.

Consequences: Trigger behavior must be tested when a Supabase database is available.

Revisit conditions: Supabase Auth lifecycle requirements become more complex.

## ADR-013 - Current Business Resolution

Status: Accepted

Date: 2026-08-18

Context: The system must support users with multiple business memberships later.

Decision: Database membership is authoritative. Phase 2 selects the first active membership as the current business only for interim application context.

Rationale: This avoids encoding a permanent one-user-one-business assumption.

Consequences: Phase 3 or later can replace this with explicit business selection.

Revisit conditions: Multiple memberships become common enough to require a switcher.

## ADR-014 - RLS Membership Helper Strategy

Status: Accepted

Date: 2026-08-18

Context: Business and membership RLS policies need to check membership without recursive-policy failures.

Decision: Use narrow `private` schema security-definer helper functions for membership and role checks, with safe `search_path` and limited grants.

Rationale: This avoids weakening tenant isolation while preventing recursive access policies on `business_members`.

Consequences: Helper functions require careful review and runtime database tests.

Revisit conditions: Policy design changes or Supabase guidance changes materially.

## ADR-015 - Audit Event Strategy

Status: Accepted

Date: 2026-08-18

Context: Phase 2 needs audit infrastructure without allowing browser clients to fabricate security events.

Decision: Store audit logs in an RLS-protected table with no authenticated browser write policy. Server-only service-role helpers record application audit events when configured.

Rationale: This prevents arbitrary client-side audit event fabrication.

Consequences: Environments without service-role configuration skip application audit writes and remain verification-pending.

Revisit conditions: A database RPC or dedicated audit service becomes necessary.

## ADR-016 - Atomic Business Onboarding RPC

Status: Accepted

Date: 2026-08-18

Context: Phase 3 must create a business and owner membership atomically for an
authenticated user while preserving Phase 2 RLS and preventing client-supplied
owner identity from becoming trusted authorization data.

Decision: Use a narrow `public.create_business_onboarding` Supabase RPC as a
`SECURITY DEFINER` function with safe `search_path`, explicit validation, and
`EXECUTE` restricted to `authenticated`. The function derives ownership from
`auth.uid()`, creates the `businesses` row, creates the owner membership, records
safe audit metadata, and resolves slug collisions inside the same transaction.

Rationale: Supabase client calls cannot make two table mutations atomic without
a database transaction boundary. Direct authenticated inserts into
`business_members` would weaken membership controls. A narrow RPC keeps the
creation path explicit and testable.

Consequences: Future changes to onboarding fields or role creation must update
the RPC, generated database types, runtime security tests, and documentation.

Revisit conditions: A broader server-side transaction mechanism replaces the
Supabase RPC boundary, or business onboarding becomes multi-business/switcher
driven.

## ADR-017 - Booking Money Uses Integer Minor Units

Status: Accepted

Date: 2026-08-18

Context: Phase 5 needs to track agreed booking value, deposit recorded, and
balance without processing payments or introducing currency conversion.

Decision: Store booking money as integer minor units in
`total_amount_minor` and `deposit_amount_minor`; derive balance instead of
storing it.

Rationale: Integer minor units avoid floating-point rounding errors, keep
validation simple, and match the current requirement to track terms rather than
settle payments.

Consequences: UI forms parse decimal user input into integer minor units before
writing. Database constraints enforce nonnegative values and deposit not
exceeding total. Future payment or tax features must decide whether additional
precision, provider amounts, or item-level money records are needed.

Revisit conditions: Supported currencies require non-2-decimal minor unit
behavior, payment provider integration requires provider-specific amount
handling, or tax/discount/line-item calculations become accepted scope.

## ADR-018 - Phase 5 Booking Items Deferred

Status: Accepted

Date: 2026-08-18

Context: The Phase 5 brief allows lightweight booking items only if they are
materially worth the complexity.

Decision: Do not implement `booking_items` in Phase 5. Use booking-level title,
description, scheduled date, total, deposit, balance, status, and internal notes
as the operational record.

Rationale: Adding item rows would imply line-item totals, catalog semantics,
inventory or fulfilment details, and item editing rules that are not required to
complete the primary booking workflow.

Consequences: Phase 5 supports structured booking records but not itemized
orders. Later phases can introduce `booking_items` with a focused migration and
tests when the product semantics are explicit.

Revisit conditions: Vendors need itemized order capture, per-item fulfilment,
catalog integration, inventory, discounts, or item-level analytics.
