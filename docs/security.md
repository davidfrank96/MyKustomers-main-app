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
trigger-owned status history. Phase 6 implements secure customer confirmation
links with hash-only token storage, one-time confirmation, revocation,
expiration, minimized public views, persistent rate limiting, and material-term
invalidation. Phase 7 implements controlled authenticated operational lifecycle
RPCs, rescheduling with confirmation invalidation, database-owned operational
timestamps, cancellation reasons, booking-change history, and operational audit
events. Phase 8 implements private feedback links, immutable feedback
submissions, internal operational issues, public feedback endpoint hardening,
and issue lifecycle authorization. Phase 9 implements tenant-private business
analytics through a membership-checked aggregate RPC over existing tenant
records without public reports or stored analytics tables. Runtime Supabase
database/RLS verification succeeded for Phase 2, Phase 3, Phase 4, Phase 5,
Phase 6, Phase 7, Phase 8, and Phase 9.
Inline customer booking creation is also runtime-verified through a narrow
authenticated transaction that derives tenant authority server-side, rejects
cross-tenant and archived customer IDs, and grants no execution to `anon` or
`PUBLIC`.
Public signup and reset-password
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

Status: VERIFIED

Customer-facing confirmation tokens must be cryptographically unpredictable and
scoped to the necessary action.

Phase 6 uses 32 bytes of cryptographically random entropy encoded as base64url
for booking confirmation links. Tokens are scoped to one booking confirmation
purpose and are not derived from booking references, IDs, customer records, or
other enumerable data.

SEC-007 - Token Storage

Status: VERIFIED

Sensitive tokens should not be stored in plaintext where secure hashing is
technically feasible.

Phase 6 stores only SHA-256 token hashes in `confirmation_links.token_hash`.
Raw confirmation tokens are generated server-side, returned once to the vendor
action result, and are not stored in database tables or audit metadata.

SEC-008 - Expiration and Revocation

Status: VERIFIED

Temporary public-access tokens must support appropriate expiration and
revocation.

Phase 6 confirmation links default to a 24-hour lifetime based on database
time, can be revoked by authorized business members, and can be regenerated.
Only one open confirmation link is allowed per booking; regeneration revokes the
prior open link.

SEC-009 - Booking Integrity

Status: VERIFIED

Bookings must stay attached to the same business, customer, reference, and
creator after creation. Booking/customer business consistency is enforced by the
database. Financial fields must remain nonnegative and deposit cannot exceed
total. Lifecycle transitions must follow the accepted booking graph, including
Phase 6 customer confirmation before `CONFIRMED`; terminal bookings must lock,
and status history must be written by database trigger rather than
browser-supplied rows.

SEC-010 - Auditability

Status: VERIFIED

Sensitive business actions must be auditable where appropriate.

SEC-011 - Rate Limiting

Status: VERIFIED

Sensitive public endpoints must be protected against automated abuse.

Phase 6 public confirmation lookups and confirmation submissions consume
persistent database-backed rate-limit buckets keyed by hashed request identity.
The implementation does not store raw IP addresses in the rate-limit table.

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

SEC-019 - Public Confirmation Minimization

Status: VERIFIED

Customer-facing confirmation pages must expose only data needed for the customer
to review the booking. Phase 6 public views omit internal notes, audit logs,
business member data, token hashes, tenant IDs, and service-role-only data.

SEC-020 - Confirmation Link Consumption

Status: VERIFIED

Public GET requests must not consume confirmation links because link previews,
messaging clients, and scanners can fetch URLs automatically. Phase 6 consumes a
link only during the POST-backed confirmation action.

SEC-021 - Atomic Customer Confirmation

Status: VERIFIED

Customer confirmation must be atomic. Phase 6 performs token validation, booking
locking, link consumption, booking status update, confirmation evidence insert,
terms hash/snapshot storage, and audit logging in one database function.

SEC-022 - Material Change Invalidation

Status: VERIFIED

Material booking-term changes after customer confirmation must not silently
replace confirmed terms. Phase 6 returns such bookings to
`AWAITING_CUSTOMER`, clears current confirmation fields, and requires a new
confirmation link. Used links continue to show the immutable snapshot the
customer originally confirmed.

SEC-023 - Controlled Operational Transitions

Status: VERIFIED

Authenticated browser clients must not directly write arbitrary booking status
or operational timestamp changes. Phase 7 routes vendor lifecycle changes
through `public.transition_booking_status`, which checks active business
membership, locks the booking row, applies the accepted transition graph, sets
operational timestamps server-side, and writes audit events.

SEC-024 - Operational History Integrity

Status: VERIFIED

Booking status history and booking change history must not be fabricated or
mutated by ordinary authenticated clients. Phase 7 keeps
`booking_status_history` trigger-owned and makes `booking_changes` read-only to
authenticated business members, with writes performed by controlled database
operations.

SEC-025 - Customer Tokens Are Not Vendor Privileges

Status: VERIFIED

Customer confirmation tokens authorize only the scoped customer-facing
confirmation action. They must not grant vendor operational privileges such as
starting work, marking ready, delivering, completing, cancelling, or
rescheduling bookings. Phase 7 runtime tests verify anonymous/token-only paths
cannot call vendor lifecycle RPCs.

SEC-026 - Terminal Booking Locks

Status: VERIFIED

Completed and cancelled bookings must not be rewritten through ordinary edits,
reschedules, or further lifecycle transitions. Phase 7 database constraints,
trigger logic, and runtime tests verify terminal lock behavior.

SEC-027 - Private Feedback Visibility

Status: VERIFIED

Customer feedback is private business data, not public review content. Phase 8
stores feedback with the owning `business_id`, exposes it only to authenticated
active members of that business through RLS, denies anonymous table access, and
keeps comments out of public token views for other states.

SEC-028 - Feedback Token Purpose Separation

Status: VERIFIED

Customer-facing feedback tokens must not be interchangeable with confirmation
tokens or any future customer token type. Phase 8 stores feedback links in a
separate table with purpose `booking_feedback`, hashes tokens at rest, and
runtime tests verify wrong-purpose token attacks fail in both directions.

SEC-029 - Feedback Eligibility And Immutability

Status: VERIFIED

Private feedback may be submitted only for completed bookings and must be
one-time and immutable after submission. Phase 8 validates booking status inside
the database transaction, consumes the link atomically, enforces one feedback
row per booking/link, blocks vendor update/delete, and verifies concurrent
submissions create exactly one feedback row.

SEC-030 - Public Feedback Endpoint Minimization

Status: VERIFIED

Public feedback pages must expose only the minimum booking context needed to
collect private feedback. Phase 8 `/f/[token]` responses use no-store,
no-referrer, and noindex headers, return safe unavailable/submitted states, and
omit internal notes, financial balances, audit logs, member data, token hashes,
tenant IDs, and private issue data.

SEC-031 - Operational Issue Tenant Isolation

Status: VERIFIED

Booking issues are internal operational records and must not be public or
cross-tenant mutable. Phase 8 enables RLS on `booking_issues`, allows
authenticated members to read/create/resolve only issues for their businesses,
denies anonymous access, blocks cross-tenant resolution, and makes resolved
issues terminal.

SEC-032 - Tenant-Private Analytics

Status: VERIFIED

Business insights are protected tenant data, even when returned as aggregates.
Phase 9 resolves the current business server-side, calls
`public.get_business_insights` with authenticated credentials, checks active
business membership inside the RPC, avoids analytics views/tables that could
bypass RLS, and runtime-tests cross-tenant aggregate denial and currency
separation.

SEC-033 - Confirmation Contact Is Scoped Evidence

Status: VERIFIED

Customer-provided email and optional phone are validated in the application and
database and stored on immutable booking confirmation evidence. Public consumed
link views expose only a masked email. Existing different customer contact data
is preserved, audit metadata contains identifiers and booleans rather than
contact values, and authenticated/anonymous roles have no direct access to
confirmation evidence or email event tables.

SEC-034 - Transactional Email Uses A Server-Only Durable Boundary

Status: VERIFIED

The confirmation transaction creates exactly one private email event before
commit. Only the service role can claim or mutate events, provider credentials
remain in server-only environment validation, and provider calls occur after
commit. Runtime tests verify race uniqueness, cross-tenant read/mutation denial,
anonymous denial, and that simulated delivery failure leaves the booking and
confirmation intact.

SEC-035 - Atomic Tenant-Safe Inline Customer Booking

Status: VERIFIED

Every booking must retain a non-null customer belonging to the same business.
`public.create_booking_with_customer` derives the actor from `auth.uid()` and
the current business from active membership, accepts no client business or
creator authority, and validates existing customers as active and tenant-owned.
Its empty `search_path`, qualified relations, revoked default privileges, and
authenticated-only execute grant harden the privileged transaction boundary.

New-customer mode creates the customer, booking, trigger-owned status history,
`CUSTOMER_CREATED`, and `BOOKING_CREATED` effects in one transaction. Runtime
tests verify rollback leaves no orphan or misleading audit, cross-tenant and
archived IDs are denied, injected business arguments are rejected, anonymous
execution fails, and contact values do not enter audit metadata.
