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
- Transactional provider secrets are Production-only, never `NEXT_PUBLIC_`, and
  one outbox event is submitted to only the selected provider.
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

Cloudflare DNS and inbound forwarding, Vercel delivery, application Brevo API,
Resend standby, and Supabase Auth email are separate trust boundaries. Provider
activation does not grant database access, alter RLS, replay historical events,
or authorize marketing contact synchronization. Supabase Auth uses Brevo custom
SMTP with the verified sender, independently from the application outbox API.

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
The structured share UI keeps that URL in a read-only field and appends it to
editable human copy only at share/copy time. Share intents use URL APIs and
encoded parameters; external windows clear `opener` before navigation.

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

Phase 6 public confirmation metadata, full lookups, confirmation submissions,
and hydrated first-open signals consume persistent database-backed rate-limit
buckets keyed by hashed request identity.
The implementation does not store raw IP addresses in the rate-limit table.
Hydrated first-open recording uses its own bounded action bucket and never
blocks the confirmation page when evidence recording fails.

SEC-012 - Sensitive Logging

Status: VERIFIED

Passwords, secrets, raw security tokens, and sensitive credentials must never be
written to application logs.

SEC-013 - Secure Storage

Status: VERIFIED FOR CURRENT UPLOAD SURFACE

Private uploaded content must not become publicly accessible by default.

The first upload surface is deliberately public business branding, not private
content. `business-logos` contains only bounded WebP logos; direct retrieval is
public, while list, insert, update, and delete policies require an active owner
for the business UUID parsed from the exact `{business_id}/logo.webp` path.
Anonymous and cross-tenant writes are runtime-denied, anonymous listing returns
no rows, and no service-role storage secret enters browser code.

The server validates source bytes, MIME, extension, decoded format, dimensions,
animation, and output before Storage. Input is limited to 2 MB, 6000px per edge,
and 25 megapixels; persisted output is metadata-stripped WebP at no more than
512px and 200 KB. Originals are discarded. Replacement overwrites the one
deterministic object. Removal clears the database reference first so cleanup
failure cannot leave a broken reference. Future private uploads still require a
private bucket or reviewed delivery abstraction and equivalent explicit bounds.

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

Dynamic social metadata uses a separate minimum-data lookup limited to valid
link state, public business name, and approved public logo path. It never
receives customer identity, contact, address, value, schedule, booking details,
notes, internal IDs, or full confirmation payloads. Protected confirmation data
remains dynamically rendered and uncached.
Known messaging/social preview user agents receive a generic server-rendered
confirmation shell; that request never calls the full booking-view RPC. This is
privacy minimization for platform previews, not an authorization substitute:
the opaque token remains the customer capability for ordinary browser access.

SEC-020 - Confirmation Link Consumption

Status: VERIFIED

Public GET requests must not consume confirmation links because link previews,
messaging clients, and scanners can fetch URLs automatically. Phase 6 consumes a
link only during the POST-backed confirmation action.

Social metadata requests also do not create `CONFIRMATION_OPENED` evidence.
First-open recording is triggered after browser hydration, is idempotent at the
database row, and is callable only through the server's service-role boundary.
It proves a valid confirmation page opened, not that a message was delivered or
read in an external application.

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

SEC-036 - CI Secrets And Database Targets Stay Non-Production

Status: IMPLEMENTED

GitHub Actions has read-only repository permission. Build and static jobs receive
no service-role key. E2E and optional runtime-security jobs reference GitHub
secrets by name and validate only presence; they do not echo values. The service
role is never exposed under a `NEXT_PUBLIC_` name. Both mutating jobs must target
a dedicated non-production Supabase project. Runtime Security additionally
requires an explicit repository enable variable and protected environment.
Normal CI never applies production migrations or uploads Playwright artifacts
that could contain raw confirmation or feedback capability links.

SEC-037 - Confirmed Terms And Cancellation Are Database-Enforced

Status: VERIFIED

Material customer-agreed fields are classified once in the application domain
and enforced by the booking integrity trigger. Crafted PostgREST updates to
customer, title, description, currency, total, deposit, or schedule fail from
`CONFIRMED` onward. Explicit rescheduling is transaction-scoped and limited to
schedule; internal notes remain non-material. Awaiting-customer material edits
revoke the active confirmation link.

Cancellation remains an authenticated membership-checked RPC. Customer/public
capabilities and cross-tenant users cannot call it. The row lock makes
concurrent cancellation canonical: one transition, reason, history row, audit,
and `BOOKING_CANCELLED` event. Confirmation evidence is not deleted or rewritten.
The outbox remains inaccessible to browser roles, recipient selection prefers
immutable confirmation contact, and provider secrets/delivery remain
service-only and post-commit.

SEC-038 - Booking Amendments Use A Purpose-Separated Atomic Capability

Status: VERIFIED

Phase B preserves the confirmed-term lock. The only general mutation exception
is set transaction-locally inside the service-only customer confirmation RPC
after it locks amendment and booking, validates the
`booking_amendment_confirmation` purpose, pending status, expiry/revocation,
eligible lifecycle state, and exact base agreement hash. Customer IDs and
internal notes are never accepted by the amendment RPC.

Raw amendment tokens use the shared 32-byte opaque-token primitive and are never
persisted or logged; only SHA-256 hashes are stored. Original confirmation,
amendment, and feedback functions query separate purpose-owned tables. Public
lookup/open/confirm functions are service-role-only behind persistent server
rate limits. Public output contains safe business identity, booking reference,
reason, and customer-agreed Current/Proposed fields; preview metadata receives
only public business identity and purpose.

`booking_amendments` has RLS enabled, no anonymous grants, tenant-scoped
authenticated SELECT, and no direct authenticated writes. Create/revoke RPCs
require active membership. One pending row per booking, row locks, base-hash
comparison, and email uniqueness prevent parallel or stale application.
Cancellation and incompatible lifecycle/reschedule actions revoke pending
capabilities.

SEC-039 - Booking Add-ons Are Tenant-Bound Purpose-Separated Evidence

Status: VERIFIED

`booking_addons` and `booking_addon_confirmation_links` have RLS enabled, no
anonymous table grants, tenant-scoped authenticated reads, and no authenticated
direct writes. Vendor create/submit/cancel RPCs derive active membership and
lock the parent; a trigger independently enforces matching business and currency.
Only `CONFIRMED` and `IN_PROGRESS` parents qualify, amount bounds use safe integer
minor units, and confirmed add-ons cannot be edited or cancelled.

Raw add-on tokens use the shared 32-byte opaque-token primitive and only SHA-256
hashes are stored. Purpose is `booking_addon_confirmation`; original booking,
amendment, feedback, and add-on tokens are rejected across every other purpose
boundary. Public view/open/confirm RPCs are service-role-only behind persistent
rate limits. Metadata contains only safe business identity and purpose; full
terms appear only after valid lookup and exclude internal notes and tenant IDs.

Confirmation locks link, add-on, and parent rows, consumes one valid link once,
marks one immutable add-on confirmed, and creates one audit and confirmation
email event. Request regeneration revokes the prior capability. Email failure
changes only outbox state. Parent reschedule, cancellation, and advancement to
`READY` revoke/cancel pending add-ons, while confirmed evidence survives parent
cancellation. Runtime tests verify cross-tenant and anonymous denial, direct
service/authenticated mutation denial, wrong-purpose attacks, confirmation races,
parent-state transitions, original evidence preservation, and analytics scope.

SEC-040 - Customer Agreement Requests Are Exclusive

Status: VERIFIED

Original confirmation/reconfirmation is state-separated from amendments and
add-ons. A booking permits at most one pending amendment and one awaiting add-on,
and database checks prevent those two request types from coexisting. Reschedule,
cancellation, and advancement to `READY` deliberately revoke or cancel pending
capabilities under row lock. Regeneration replaces only the same request purpose.
Draft add-ons have no customer capability and do not affect effective terms.

SEC-041 - Production Deployment Preserves Secret And Migration Boundaries

Status: VERIFIED

Vercel Production contains only `NEXT_PUBLIC_APP_URL`, the browser-safe Supabase
URL and publishable key, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. The
service role is marked Sensitive, has no public prefix, and remains behind
`server-only` configuration. Direct database credentials, email-provider values,
E2E credentials, and runtime-test controls are not deployed. Preview and
Development receive none of the Production variables.

The stable HTTPS hostname is the application base URL and Supabase Auth Site URL.
Only the exact dashboard-confirmation and password-recovery callback URLs are
allowed; no Preview wildcard is present. Production public capability routes
retain no-store and noindex behavior, capability values are absent from reports,
and fetched production HTML contains no localhost URL. Vercel Git integration
deploys known `main` commits after CI; builds never apply database migrations.
The initial controlled production workflow cleaned its fixtures and produced no
Warning, Error, or Fatal runtime log entries.

SEC-042 - Current Business Preference Cannot Grant Tenant Access

Status: VERIFIED

The selected business UUID is stored in an HTTP-only, same-site cookie and is
untrusted input. Server resolution accepts it only when the authenticated user
has an active `business_members` row for the same UUID; otherwise it falls back
to another active membership or onboarding. The switch action repeats this
check before changing the cookie. Membership-specific role checks govern owner
settings after every switch.

`create_booking_with_customer` now requires the resolved business UUID and
validates that exact active membership inside its hardened SECURITY DEFINER
boundary. Forged switch submissions and cross-tenant RPC business IDs are denied
without changing current authority or creating data. Public confirmation,
amendment, add-on, and feedback capabilities do not consult this cookie.

During the shared-database frontend rollout, the prior booking RPC signature is
retained as a compatibility wrapper only for callers with exactly one active
membership. It delegates to the explicit-business function and rejects two or
more memberships with `explicit_business_required`; it never chooses a first
membership for an ambiguous account.

SEC-043 - Google OAuth Preserves Existing Identity And Redirect Boundaries

Status: VERIFIED - PRODUCTION

Google authentication is delegated to Supabase Auth and uses the existing PKCE
callback. Application code contains no Google client secret, stores no provider
token, and creates no email-derived identity row. The provider control fails
closed when Supabase's public settings do not report Google enabled. Callback
errors map to fixed user-safe messages and raw provider details are not rendered.

The OAuth destination is derived from `NEXT_PUBLIC_APP_URL`, constrained to the
configured Supabase `/auth/v1/authorize` origin/path, and returns through the
exact production callback. A ten-minute HTTP-only, same-site, callback-scoped
cookie contains only a sanitized local path and is consumed at callback; it is
neither session state nor authorization. Profile metadata remains descriptive
only. `auth.users.id`, active membership checks, current-business validation,
and RLS continue to provide identity and tenant authority.

The configured provider now reports enabled. Real Google authorization completed
through the normal local application callback, established a Google session,
provisioned a profile, persisted after refresh, exercised zero, one, and
multiple-business resolution and switching, and cleared the session on logout
without exposing transient credentials. After required CI passed and the merge
deployed, production OAuth repeated the callback, multi-business resolution,
switching, persistence, logout, and protected-route checks. No nonce, PKCE,
state, cookie, or redirect validation was weakened.

Next.js development incoming-request logging explicitly ignores only
`/auth/callback`, preventing transient authorization-code query strings from
being printed by the framework. Other development request logging remains
enabled. Application code does not log OAuth codes, provider tokens, or session
cookies.

SEC-044 - Feedback Sharing Evidence Is Purpose-Scoped And Truthful

Status: VERIFIED

Private feedback sharing uses only `booking_feedback` links for completed
bookings in the active tenant. The server validates the current membership,
booking, business, link purpose, expiry, revocation, consumption, and submitted-
feedback state before recording a share method. Audit metadata contains only
identifiers and the selected method; it contains no raw capability, message,
customer contact, or provider claim.

`public.record_feedback_link_open` is executable only by `service_role`, uses a
fixed empty search path and qualified relations, hashes the supplied token, and
writes the first-open timestamp and one audit event idempotently. Anonymous and
authenticated roles cannot execute it directly. Wrong-purpose, expired, revoked,
used, unknown, non-completed, and cross-tenant states fail closed. Preview
crawlers receive metadata-only content and never invoke the open path.

Public `/f` pages and their open endpoint remain no-store, noindex, and
no-referrer. No external redirect input is accepted. No cache may be introduced
for authenticated or tenant-scoped data without explicit cache scope, key,
invalidation behavior, and cross-tenant security analysis. Public capability-
token pages must remain non-cacheable unless a future security review explicitly
changes the rule.

## Platform Administration

`business_members` tenant authority and `platform_admins` platform authority are
permanently separate. Only an authoritative `ACTIVE SUPER_ADMIN` row may enter
`/admin`. The table has RLS and no anonymous/authenticated table grants or
policies; the only browser-callable surface returns the active caller's own row.
Profile metadata, email, OAuth provider, client state, business ownership, and
current-business preference have no effect on platform authority.

Admin authorization must precede every future privileged platform query. Admin
creation, role/status changes, and disablement are audited; page navigation is
not. Bootstrap, threats, MFA readiness, and deferred capabilities are defined in
`docs/ADMIN_SECURITY.md`.

Admin Phase 2 uses `get_platform_admin_overview()`, a stable `SECURITY DEFINER`
function with an empty search path, fully qualified relations, and its own
active-`SUPER_ADMIN` caller check. Execute is limited to `authenticated`; the
function denies anonymous, ordinary, business-owner, multi-business-owner, and
disabled callers. It returns only aggregate counts and a server timestamp.
Current-business cookies do not influence its result. No PII, monetary totals,
record identifiers, service-role credential, mutation, or generic privileged
query reaches the admin page.

Admin Phase 3 uses four additional postgres-owned `SECURITY DEFINER` functions
with the same empty search path and active-`SUPER_ADMIN` recheck. The normal
authenticated server client invokes them only after `requirePlatformAdmin()`.
Business projections contain business contacts, active membership identity, and
aggregate counts needed for support; they never contain customer rows, booking
terms, feedback text, audit payloads, or delivery recipient data. User
projections contain ID, profile name, email, account timestamps, provider names,
membership relationships, and only the target user's specific admin role/status.
They exclude password hashes, tokens, sessions, Auth metadata, and provider
identity payloads. Browser roles receive no new table grants.

Search is bounded and uses literal substring comparison rather than wildcard or
client-composed PostgREST expressions. UUID route parameters are validated.
Directory/detail reads produce no audit events. Ordinary users, business owners,
anonymous users, and disabled administrators must fail both route and direct-RPC
checks. No write, impersonation, suspension, credential, or membership control
is present.

Admin Phase 4 retains both authorization layers: the `/admin` layout checks the
authenticated identity, every server query calls `requirePlatformAdmin()`, and
each new postgres-owned RPC invokes the private active-`SUPER_ADMIN` assertion.
PUBLIC/anonymous execution is revoked, authenticated execution is useful only
after the internal check, search is literal/bounded, and UUID routes fail safely.

Booking directories omit customer contacts, internal notes, private feedback,
confirmation evidence, and email payloads. Booking detail masks confirmed
contact evidence and omits raw terms/hashes, tokens, internal notes, private
feedback comments, and recipient/provider/failure data. Issue descriptions are
absent from lists and available only through the independently authorized detail
RPC. Reads emit no audit event. Ordinary owners, ordinary users, anonymous
users, and disabled admins remain denied by the unchanged authority predicate.
The approved migration was applied to the configured production-backed project.
Anonymous grant-boundary denial and active-admin reads were directly reverified;
ordinary-user and disabled-admin denial continue to rely on the unchanged helper
and previously verified platform-admin runtime/revocation coverage rather than
production authority mutation.
PR #17 subsequently passed all eight checks and merged as `edbef26`; Vercel
deployed that exact commit and the authenticated production read-only smoke
passed for all four routes without creating authority or domain fixtures.

SEC-049 - Platform Email Operations Minimizes Customer Communication Evidence

Status: VERIFIED - PRODUCTION

Email Operations is authorized twice: the server route requires the active
platform administrator, and each postgres-owned `SECURITY DEFINER` RPC invokes
the database active-`SUPER_ADMIN` assertion with an empty search path. PUBLIC and
anonymous execution remain revoked; authenticated execution does not bypass the
internal authority check. Browser roles receive no `email_events` table grant.

Directory payloads contain no recipient, customer contact, message content,
provider identifier, raw failure, request/response, token, or secret. Detail may
return only `private.mask_contact_email` output and one fixed failure category.
Reads are platform-wide, independent of tenant selection, immutable, and not
audited. Retry/resend is absent because it would trigger customer communication
and durable state mutation.

The approved migration applied transactionally with unchanged outbox and active
admin counts. Anonymous, ordinary-user, and disabled-admin invocation is denied;
an active temporary zero-business admin could read summary/list/detail; before
and after outbox state was identical; and temporary authority/Auth cleanup
returned to zero leftovers and one approved active production admin.

PR #19 passed the required checks and merged as `52a1820`; Vercel deployed the
exact commit. Authenticated production smoke with the existing approved admin
session verified minimized live summary/list/detail reads, filters, pagination,
masked recipient output, cross-links, and the absence of write controls. No
production email/domain fixture was created. Failed temporary Auth creation
attempts produced no user UUID or residue, and one active production
`SUPER_ADMIN` remains.

SEC-050 - External Transactional Email Is Server-Only And Minimized

`BREVO_API_KEY` and `RESEND_API_KEY` are accepted only by server environment
validation and provider modules marked `server-only`; no public-prefixed vendor
credential exists. Provider selection fails closed when the selected external
adapter lacks a valid key or sender and does not fall back to another real
provider.

Transactional providers receive only the minimum message and direct recipient
information needed for the specific event. The adapters do not create contacts,
lists, campaigns, or marketing state and do not log recipients, bodies, secure
URLs, credentials, or provider payloads. Failure bodies are not parsed or
returned; bounded categories feed the existing outbox classifier. Atomic claim
and event uniqueness remain authoritative, while provider failure changes only
the email event and never reverses committed domain state.
