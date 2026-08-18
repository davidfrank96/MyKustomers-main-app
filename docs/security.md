# Security

## Status

Security requirements are documented. Phase 2 implements initial authentication,
tenant schema, RLS policy definitions, server authorization helpers, service-role
boundaries, and audit infrastructure. Phase 3 implements atomic business
onboarding and owner profile updates without weakening tenant RLS. Phase 4
implements tenant-scoped customer records with customer RLS, immutable customer
business ownership, and archive semantics. Phase 5 implements tenant-scoped
booking records, booking/customer business consistency, immutable booking
ownership fields, constrained lifecycle transitions, terminal booking locks, and
trigger-owned status history. Runtime Supabase database/RLS verification
succeeded for Phase 2, Phase 3, and Phase 4. Public signup and reset-password
completion remain partial because the configured development Supabase project
hit email/default inbox constraints.

Documentation is not implementation evidence. For example, this document saying
RLS is required does not mean RLS policies exist.

## Security Principles

Security principles for all future phases:

- Multi-tenant isolation must be enforced in the database and server code.
- Authorization is enforced server-side; frontend filtering is never trusted.
- PostgreSQL Row Level Security is required for tenant-owned Supabase tables.
- No service-role key may be imported into or exposed from client components.
- Secrets stay in server-only environment variables and are never logged.
- External input must be validated before domain logic runs.
- Output must be encoded by framework-safe rendering primitives.
- Sensitive public endpoints need rate limiting.
- Temporary customer-facing tokens must be high entropy, scoped, expiring, and
  hashed at rest where appropriate.
- Sensitive actions should produce audit logs when audit infrastructure exists.
- Apply least privilege to database roles, storage buckets, and service keys.
- File access must verify tenant ownership before returning signed URLs or data.
- Origin and CSRF protections must be considered for state-changing requests.
- Application logs must not contain credentials, tokens, customer private data,
  or security-sensitive implementation details.

Explicit tenant rule:

> A user belonging to Business A must never be able to access any customer,
> booking, feedback, file, analytics record, or configuration belonging to
> Business B.

Supabase-specific rules:

- Do not use user-editable metadata for authorization decisions.
- Do not create `TO authenticated` policies without ownership predicates.
- Views and privileged functions require a specific security review before use.
- Storage policies must cover read, write, update, and delete behavior
  intentionally.

## Security Invariants

SEC-001 - Tenant Isolation

Status: VERIFIED

A user belonging to Business A must never access Business B customers, bookings,
feedback, files, analytics, settings, or other protected resources.

SEC-002 - Server Authorization

Status: VERIFIED

Authorization decisions must be enforced server-side. Frontend visibility is not
authorization.

SEC-003 - Row Level Security

Status: VERIFIED

Appropriate Supabase/PostgreSQL tenant-owned tables must use RLS unless there is
a documented architecture reason not to.

SEC-004 - Service Role Protection

Status: VERIFIED

Supabase service-role credentials must never reach browser/client code.

SEC-005 - Input Validation

Status: VERIFIED

Untrusted external input must be validated at server boundaries.

SEC-006 - Secure Customer Tokens

Status: PLANNED

Customer-facing confirmation tokens must be cryptographically unpredictable and
scoped to the necessary action.

SEC-007 - Token Storage

Status: PLANNED

Sensitive tokens should not be stored in plaintext where secure hashing is
technically feasible.

SEC-008 - Expiration and Revocation

Status: PLANNED

Temporary public-access tokens must support appropriate expiration and
revocation.

SEC-009 - Booking Integrity

Status: VERIFIED

Bookings must stay attached to the same business, customer, reference, and
creator after creation. Booking/customer business consistency is enforced by the
database. Financial fields must remain nonnegative and deposit cannot exceed
total. Lifecycle transitions must follow the accepted Phase 5 graph, terminal
bookings must lock, and status history must be written by database trigger
rather than browser-supplied rows.

SEC-010 - Auditability

Status: VERIFIED

Sensitive business actions must be auditable where appropriate.

SEC-011 - Rate Limiting

Status: PLANNED

Sensitive public endpoints must be protected against automated abuse.

SEC-012 - Sensitive Logging

Status: VERIFIED

Passwords, secrets, raw security tokens, and sensitive credentials must never be
written to application logs.

SEC-013 - Secure Storage

Status: PLANNED

Private uploaded content must not become publicly accessible by default.

SEC-014 - Least Privilege

Status: VERIFIED

Database, server, storage, and integration privileges must follow least
privilege.

Phase 3 business creation uses `public.create_business_onboarding`, a narrow
`SECURITY DEFINER` function with safe `search_path` and `EXECUTE` granted to
`authenticated` only. The function derives the owner from `auth.uid()` and does
not accept an `owner_user_id` parameter.

SEC-015 - Dependency Security

Status: VERIFIED

Known dependency vulnerabilities must be reviewed as part of verification and
production readiness.

SEC-016 - Customer Tenant Isolation

Status: VERIFIED

A customer record must only be accessible to active members of the business that
owns that customer. Phase 4 verifies cross-tenant select, update, archive,
unauthorized create, anonymous access, archived-record protection, and search
isolation against the configured development Supabase database.

SEC-017 - Booking Tenant Isolation

Status: VERIFIED

A booking record must only be accessible to active members of the business that
owns that booking. Phase 5 adds RLS policies for `bookings` and
`booking_status_history`; authenticated members can read/create/update bookings
for their businesses, while status-history writes remain trigger-owned. Runtime
tests verify cross-tenant select/update denial, unauthorized create denial,
anonymous denial, member permissions, and search isolation.

SEC-018 - Booking References Are Not Secrets

Status: VERIFIED

Booking references are database-generated, human-readable identifiers for vendor
operations. They must never authorize access by themselves. Access must continue
to come from authenticated business membership or future scoped customer tokens.
