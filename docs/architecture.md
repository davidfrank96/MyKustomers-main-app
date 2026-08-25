# Architecture

Detailed accepted decisions are recorded in `docs/DECISIONS.md`. This document
summarizes the current architecture and must not be used to silently override an
accepted ADR.

Documentation is not implementation evidence. Planned architecture must be
distinguished from implemented code and verified behavior.

## Current Snapshot

My Customers is one Next.js modular monolith. Supabase Auth supplies platform
identity; PostgreSQL and RLS enforce tenant ownership. Validated server actions
or server-only route handlers call tenant-scoped queries and narrow RPCs for
atomic or privileged workflows. The service-role client is isolated to explicit
server boundaries. Public confirmation and feedback links are scoped,
high-entropy capabilities whose hashes are stored at rest. Audit events preserve
material activity, the durable email outbox separates transactional state from
delivery, and an authenticated aggregate RPC provides private analytics.

The authenticated shell keeps five primary mobile destinations and exposes
account/session controls through a secondary account menu. Dashboard summary
links use ordinary semantic routes and validated list query parameters rather
than client-only navigation state.

## Integration Architecture

GitHub Actions is the repository CI boundary. Pull requests into and pushes to
`main` run independent quality, test, build, dependency, and browser jobs with
read-only repository permission. E2E owns its local Next.js server and may use
only a dedicated non-production Supabase project. Live runtime security is a
separate protected-environment job. GitHub Actions does not deploy or apply
database migrations. Separately, Vercel Git integration deploys merged `main`
commits to `my-kustomers-main-app.vercel.app`; builds consume the existing schema
and never mutate it. The initial Vercel runtime uses the existing development
Supabase project with four Production-only variables documented in
`docs/DEPLOYMENT.md`; Preview receives no privileged environment values.
Vercel functions execute in London (`lhr1`) to align with the configured
Supabase AWS `eu-west-2` region; the application remains on the Node runtime.

## Inline Customer Booking Boundary

New Booking presents existing and new customer modes, but both converge on
`public.create_booking_with_customer`. The authenticated `SECURITY DEFINER` RPC
derives `auth.uid()` and the same first active membership used by current-
business resolution. It accepts no business or creator authority from the
client, uses an empty search path and qualified relations, and is executable by
`authenticated` only.

Existing mode locks and validates an active same-business customer. New mode
normalizes and creates the customer, then creates the ordinary booking and both
audit events in the same PostgreSQL transaction. Existing booking reference and
status-history triggers remain authoritative. A booking failure therefore
rolls back the inline customer and audit rows as well.

## Booking Confirmation Email Boundary

The public confirmation server action validates and normalizes contact input,
then calls the existing service-role confirmation RPC. PostgreSQL locks the
link, booking, and customer and commits link consumption, booking transition,
immutable confirmation/contact evidence, conservative customer enrichment,
audit linkage, and one `BOOKING_CONFIRMED` outbox event together.

External email is never sent inside that transaction. After commit,
`lib/email/outbox.ts` atomically claims the event, renders HTML and plain text
from the immutable terms snapshot, and calls a provider-neutral interface. The
development adapter makes no external request; the optional Resend adapter is
enabled only by explicit server environment configuration. Delivery failure is
recorded on the event and never reverts the confirmed booking.

## Trusted Confirmation Sharing Boundary

The generated raw confirmation URL still exists only in the successful vendor
action result. A client dialog keeps it read-only while composing editable
privacy-safe copy for native share, WhatsApp, Telegram, or clipboard actions.
Each successful method selection calls a tenant-validated server action that
records only booking/link IDs and the method; it does not claim provider
delivery or read state.

Dynamic route metadata uses a separate service-only lookup that selects only
link validity and public business name/logo. The full customer confirmation RPC
remains the sole source of booking review data. A post-hydration endpoint hashes
the token server-side and calls an idempotent service-only first-open RPC, so
ordinary social crawlers do not become customer-view evidence.
Known messaging/social preview user agents also return a generic shell before
the full booking lookup, preventing common preview fetchers from receiving the
customer/order body. Token validation remains authoritative for normal browser
access; user-agent classification is only an additional preview-privacy layer.

## Trusted Feedback Sharing Boundary

Feedback request sharing reuses the confirmation sharing component and method
model but keeps a purpose-specific message and capability. The successful
generation result is the only source of the raw `/f` URL. A tenant-authorized
server action records the chosen method with booking/link identifiers only and
does not claim delivery, reading, or submission.

Metadata uses a separate service-only lookup restricted to validity and public
business identity. Recognized preview crawlers receive a generic private-
feedback shell before the booking lookup and cannot record an open. Ordinary
browsers post to a no-store endpoint after load; PostgreSQL hashes and validates
the token and writes `first_opened_at` plus one `FEEDBACK_OPENED` audit event
idempotently. The existing feedback view/submission RPC remains authoritative.

## Request Memoization And Loading

React server `cache` deduplicates authenticated user and current-business
resolution only during one server render request. Current-business resolution
uses one RLS-scoped membership/business relation read; standalone membership
reads remain available for actions that require only membership authorization.
Shared module-level functions and stable zero-argument calls are required for
deduplication. There is no persistent application cache for authenticated,
tenant-scoped, analytics, or capability-token data, so membership revocation
and business switches take effect on the next request without an application
invalidation protocol.

Major route segments use server-rendered structural loading states rather than
turning whole pages into client components. Skeletons are presentation-only,
have stable responsive dimensions, expose one accessible loading status, and
disable animation under reduced motion. A tenant switch presents an opaque
pending layer so data from the previous workspace is not exposed as current.
The permanent cache rules and measurements are in `docs/PERFORMANCE.md`.
Booking and feedback reads use existing composite foreign-key relationships to
return narrow associated labels in the authorized query instead of performing a
second sequential HTTP request. Dashboard monthly analytics streams behind one
secondary Suspense boundary while operational queues remain the primary render.

## Business Logo Storage Boundary

`POST` and `DELETE /api/businesses/[businessId]/logo` authenticate the current
user, require an active owner role, and use that user's normal Supabase client
so Storage RLS remains authoritative. The route rejects oversized bodies before
decoding where possible, validates raster content with Sharp, preserves aspect
ratio, emits metadata-stripped WebP no larger than 512px/200 KB, and stores one
deterministic object. No raw source is persisted.

The `business-logos` bucket is public only for object retrieval. Authenticated
owner policies protect exact-path listing, upload, replacement, and deletion;
anonymous listing/writes and cross-tenant writes remain unavailable. Public
confirmation RPCs return only `logo_path`, validated website, existing
Instagram handle, and business name in addition to the established minimized
booking view. These identity fields are not part of the immutable booking terms
hash, so branding changes do not invalidate a customer's confirmed terms.

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
- `/a/[token]` for public customer amendment confirmation links.
- `/x/[token]` for public customer add-on confirmation links.
- `/f/[token]` for public private-feedback links.

Feature folders hold domain code for auth, businesses, customers, bookings,
confirmation links, feedback, analytics, billing, and settings. Shared UI
primitives live in `components/ui`; shared composition belongs in
`components/layout`, `components/forms`, or `components/shared` only when reuse
is real.

## Supabase Architecture

Supabase Auth and the initial tenant schema are implemented in Phase 2. Business
onboarding, customer management, booking management, secure confirmation links,
operational booking lifecycle controls, private feedback, internal booking
issues, and read-only business insights extend that schema with tenant-owned
records, RLS policies, database constraints, narrow RPCs, and focused runtime
security tests. Phase 9 analytics are derived through an authenticated
membership-checked aggregate RPC over existing tenant records rather than
stored analytics tables or public reports. Client
construction lives in `lib/supabase`, using browser, server, proxy, and
server-only service-role helpers separately so secrets do not cross into client
bundles.

Authenticated server identity is derived from Supabase's validated JWT claims.
The shared auth boundary reuses that identity for membership and current-
business resolution so protected actions do not repeat Auth validation calls.
Current-business enforcement is centralized in `lib/auth/server.ts`; feature
actions remain responsible for their domain validation and mutations.

Email/password and Google OAuth share the same Supabase Auth identity boundary.
Google starts through one server action, returns to the existing PKCE callback,
and then enters the ordinary dashboard/onboarding and membership-resolution
path. The provider status is read from Supabase's public Auth settings and fails
closed when unavailable. A short-lived callback-scoped cookie may remember a
sanitized local destination; it contains no token and grants no authority.

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
public customer-facing pages. Analytics aggregates are protected tenant data
and must not include records from another business. Tenant-owned tables must include a business
ownership model and PostgreSQL RLS policies that enforce row access server-side.

## Server and Client Boundaries

Server-only environment values live behind `lib/config/server-env.ts`, which
imports `server-only`. Client-safe values use the `NEXT_PUBLIC_` prefix and are
validated separately. UI components should not directly perform database access;
server actions, route handlers, or feature-level server modules should own data
access.

Feature query modules should project only the fields required by list and queue
views. Full rows, private notes, snapshots, and other detail-only fields belong
in authorized detail queries. Independent reads may run concurrently, while
tenant ownership remains enforced by explicit business filters and PostgreSQL
RLS.

## Testing Strategy

Vitest covers shared utilities, domain validation, static migration/security
checks, and opt-in runtime Supabase tenant tests. Playwright covers browser
journeys for auth, onboarding, customers, bookings, customer confirmation, and
the operational booking lifecycle, private feedback, and internal issue
resolution, and business insights. Booking coverage includes selecting an
existing customer and creating a name/contact customer inline after an explicit
exact-match warning.

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

## Confirmed Agreement Integrity

### Permanent booking invariants

1. Every booking belongs to exactly one business and one customer from that business.
2. Customer-confirmed material terms are immutable outside narrow database-owned workflows.
3. Amendments change existing confirmed scope only after customer approval.
4. Add-ons represent new scope and never rewrite original confirmation evidence.
5. Pending customer agreement requests do not alter effective terms.
6. Only confirmed add-ons affect current agreed value, deposit, and balance.
7. Independently delivered work requires a separate booking.
8. Cancellation preserves original confirmation, amendment, add-on, and history evidence.
9. Public capabilities are purpose-separated, opaque, expiring, hash-only at rest, and one-time.
10. External email failure never rolls back committed booking-domain state.

### Customer agreement request matrix

| Existing unresolved request          | Original confirmation                        | Amendment                                  | Add-on                                                            | Reschedule                                               |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Original confirmation/reconfirmation | Replace/regenerate the scoped link           | Blocked by booking state                   | Blocked by booking state                                          | Replaces the schedule and requires a new link            |
| Amendment                            | Not eligible in the same booking state       | Replaces/revokes the prior amendment       | Blocked                                                           | Revokes the amendment, then requires reconfirmation      |
| Add-on                               | Not eligible in the same booking state       | Blocked                                    | Reissues the same add-on link; another awaiting add-on is blocked | Cancels the pending add-on, then requires reconfirmation |
| None                                 | Allowed only for `DRAFT`/`AWAITING_CUSTOMER` | Allowed only for `CONFIRMED`/`IN_PROGRESS` | Allowed only for `CONFIRMED`/`IN_PROGRESS`                        | Allowed only before operational work starts              |

`DRAFT` add-ons are vendor workspace records, not unresolved customer requests.
The database remains authoritative for this matrix through booking-state checks,
partial uniqueness, row locks, and parent-change cleanup triggers.

The booking integrity trigger is the database authority for customer-agreed
terms. From `CONFIRMED` through later lifecycle states, direct changes to
customer, title, customer-facing description, currency, total, deposit, or
schedule fail. Internal notes remain a non-material tenant field until terminal
lock. Material edits while `AWAITING_CUSTOMER` revoke the open link.

`public.reschedule_booking` is an explicit workflow, not an ordinary update. It
sets a transaction-local permission, updates only schedule, returns a confirmed
booking to `AWAITING_CUSTOMER`, clears current confirmation fields, revokes open
links, and records focused change/audit history. Add-ons
must add explicit records rather than weakening this boundary.

Phase B general amendments are a separate aggregate, not a temporary booking
status. `public.create_booking_amendment` freezes current/proposed structured
terms and the latest confirmation contact while leaving `bookings` unchanged.
The `/a/[token]` server boundary hashes the distinct capability before invoking
service-only public view/open/confirm RPCs. Confirmation locks amendment and
booking rows, verifies the current effective hash, sets a transaction-local
integrity-trigger exception, applies only allowed material fields, and writes
effective evidence/history/audit/outbox state atomically. Vendor table reads are
tenant-RLS scoped; vendor create/revoke RPCs derive membership. Cancellation,
advancement to `READY`, and explicit reschedule revoke pending amendments.

Phase C add-ons are a second child aggregate for new scope, not another booking
mutation path. Vendor RPCs derive tenant and parent authority and persist a
structured draft. Submission freezes terms/contact and creates an independent
`/x/[token]` capability; the server hashes the raw token before service-only
view/open/confirm RPCs. Atomic confirmation changes only add-on/link/audit/outbox
state. Confirmed add-ons are immutable and are joined only for derived current
totals and analytics. Pending add-ons and amendments are mutually exclusive;
parent schedule/lifecycle triggers revoke pending add-on capabilities.

`public.transition_booking_status` locks the booking before cancellation,
validates active membership and reason, writes status/history/audit state, and
inserts one `BOOKING_CANCELLED` outbox event before commit. Provider delivery is
post-commit through the existing service-only email boundary, so failure changes
delivery state but never cancellation truth.

## Current Business Resolution

Authenticated dashboard layouts are dynamic. They load ordered active
`business_members`, fetch the bounded set of corresponding business identities,
and resolve the HTTP-only preference only when its UUID appears in that set.
Zero active memberships routes to onboarding; one selects automatically; two or
more restore a valid preference or use the first deterministic membership.

The shell receives the resolved business and minimal accessible-business list.
Its shared switcher calls a server action that rechecks the current user's active
membership, writes the cookie only after success, invalidates the layout, and
redirects to `/dashboard`. Domain pages pass the resolved business ID into
customer, booking, analytics, and settings queries. Atomic inline booking
creation also receives that ID and independently validates it in Postgres.
Public token routes never enter this resolution path.

The Business page receives that same bounded accessible-business list through
its existing profile loader. It renders the current membership and switchable
memberships but posts every switch through the exact same server action as the
header; neither surface turns a submitted business ID into authority.

## Platform Admin Boundary

The platform-admin namespace is a separate domain shell within the monolith.
Supabase Auth establishes identity, `platform_admins` establishes platform
authority, and `business_members` continues to establish tenant authority. The
admin layout authenticates first and then uses the caller's normal server
Supabase client to invoke an active-caller-only identity function. It does not load
business context or import the service-role client.

Admin Phase 2 follows that guard with `features/admin/queries.ts`, a server-only
boundary that invokes `get_platform_admin_overview()`. The database function
rechecks active `SUPER_ADMIN` authority and returns aggregate counts only. Its
single-statement snapshot is independent of the current-business cookie and
contains no row-level or financial data.

Privileged platform reads must remain narrow, server-only operations after
`requirePlatformAdminRole`. A generic unrestricted admin data client is not an
accepted architecture. See `docs/ADMIN_SECURITY.md` and ADR-037.

Admin Phase 3 keeps that architecture. `features/admin/queries.ts` authorizes
first, then makes exactly one authenticated RPC call for each directory or
detail request. Database-side materialized page sets aggregate business owners
and counts without N+1 calls. User functions project only allowlisted fields from
the privileged Auth schema; no service-role client or raw Auth object enters the
route tree. `features/admin/directory.ts` strictly parses every JSON shape and
fails closed on extra fields. Search and page state remain in the URL, and the
current-business cookie is not read anywhere in this boundary.
