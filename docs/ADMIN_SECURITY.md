# Platform Admin Security

STATUS: ADMIN PHASES 0/1-5 VERIFIED IN PRODUCTION; PHASE 6A IMPLEMENTED, VERIFICATION PENDING

This document defines the security boundary for My Customers platform
administration. It is intentionally narrower than a complete admin-console
design. The only implemented operational capability is read-only. Admin Phase
6A adds native MFA and a privileged-action security framework, but no admin
mutation. Later actions remain separately controlled and are not authorized by
this work.

## Permanent Authorization Invariant

`business_members` authorizes access to one business tenant.

`platform_admins` authorizes access to the My Customers platform-admin
namespace.

Neither system grants the other automatically. Owning one or many businesses
does not grant platform authority, and a platform administrator does not need a
business membership to access `/admin`.

## Identity And Role Model

Platform administrators use ordinary Supabase Auth identities. Password and
Google authentication establish identity only; authorization is resolved from
the authoritative `public.platform_admins` row keyed by `auth.users.id`.

Admin Phase 1 implements one role, `SUPER_ADMIN`, and two statuses, `ACTIVE` and
`DISABLED`. Only `ACTIVE` authorizes access. Unused roles are not defined.
Disablement preserves the Auth account and audit history while revoking admin
authority on the next request.

No email address, profile metadata, JWT custom claim, local storage value,
business role, cookie preference, or URL parameter is platform authority.

## Request Boundary

The dedicated `/admin` layout performs these operations in order:

1. `requireUser("/admin")` validates the current Supabase session.
2. `requirePlatformAdminRole` calls the authenticated, self-scoped
   `get_my_platform_admin` RPC.
3. The RPC returns only the caller's row and only when its status is `ACTIVE`.
4. The server validates the returned user ID, role, and status before rendering.

Unauthenticated users are sent through normal login. Authenticated users without
active authority receive a generic `Not authorized` response. Database errors,
unexpected row counts, and unrecognized values fail closed.

Admin authorization runs only in the admin namespace. Vendor routes do not pay
for an admin lookup.

## Database Boundary

`public.platform_admins` has RLS enabled and no browser policy. All privileges
are revoked from `public`, `anon`, and `authenticated`. Browser roles therefore
cannot select, enumerate, insert, update, or delete admin records.

`public.get_my_platform_admin` is the only browser-callable database surface.
It is a stable `SECURITY DEFINER` function with an empty search path, qualified
relations, `auth.uid()` caller scoping, an `ACTIVE` status predicate, no PUBLIC
or anonymous execute grant, and execute granted only to `authenticated`.

The route guard uses the caller's normal RLS-aware Supabase server client. It
does not import the service-role client. No generic privileged query utility or
database console is introduced.

`public.get_platform_admin_overview` is the Phase 2 privileged read. It repeats
the active-`SUPER_ADMIN` check, has the same empty-search-path and grant posture,
and returns aggregate counts plus a timestamp only. It does not return row IDs,
identity/contact data, booking terms, or monetary values. The application calls
it through `features/admin/queries.ts` only after the route guard.

Admin Phase 3 adds four operation-specific directory/detail functions. They are
postgres-owned, stable, empty-search-path, and repeat the same active
`SUPER_ADMIN` check before reading platform-wide records. Business functions
return support identity, active memberships, and aggregates. User functions
project only email, safe account timestamps, provider names, membership
relationships, and the viewed user's specific platform-admin state from the Auth
schema. They do not grant access to `auth.users` or `auth.identities`, return raw
Auth rows, or introduce a service-role application module. Every application
query calls `requirePlatformAdmin()` before the RPC and strictly parses the DTO.

Future platform-data functions must authorize the active admin before any
privileged query and must expose only a narrow operation or projection.

## Controlled Bootstrap

There is no public or authenticated bootstrap endpoint and no `Become admin`
control. The first administrator is created by a trusted database operator:

1. The intended person creates and verifies a normal Supabase Auth account.
2. A trusted operator obtains that account's UUID through controlled Supabase
   Auth tooling and independently confirms the intended identity.
3. In a reviewed transaction, the operator inserts the UUID with
   `role = 'SUPER_ADMIN'` and `status = 'ACTIVE'` into `platform_admins`.
   `created_by` is the authenticated operator UUID when one exists; it remains
   null for an external database-control-plane operator rather than falsely
   attributing the change to the target user.
4. The operator verifies one `PLATFORM_ADMIN_CREATED` audit event, an active
   self-scoped RPC result, and successful `/admin` access.
5. The operator records the change ticket or approval outside customer-facing
   application data. No database URL or service credential is included.

After separate production authorization, the controlled database operation is:

```sql
begin;

insert into public.platform_admins (user_id, role, status)
values ('<independently-verified-auth-user-uuid>'::uuid, 'SUPER_ADMIN', 'ACTIVE');

select event_type, metadata
from public.audit_logs
where event_type = 'PLATFORM_ADMIN_CREATED'
  and metadata ->> 'target_user_id' = '<independently-verified-auth-user-uuid>'
order by created_at desc
limit 1;

commit;
```

The operator aborts instead of committing if the target, inserted role/status,
or audit event is unexpected. The target then verifies `/admin` through their
own normal authenticated session. This procedure was run for the separately
approved existing production Auth identity. It resulted in exactly one active
`SUPER_ADMIN` and one creation audit. The identity UUID and email are not
reproduced in repository documentation.

Later additions use the same reviewed operation until a separately designed
admin-management workflow exists. Revocation changes status to `DISABLED`;
routine operations must not delete the record. There is no permanent
`ADMIN_EMAIL` or personal-email allowlist.

Development and E2E tests create temporary admins through the service-role
fixture boundary and delete their audit rows, admin rows, business fixtures,
and Auth users in dependency order.

## Audit Decision

The database records `PLATFORM_ADMIN_CREATED`, `PLATFORM_ADMIN_UPDATED`, and
`PLATFORM_ADMIN_DISABLED` for security-relevant row changes. Metadata contains
the target user UUID, previous/new role and status where applicable, and whether
the actor came from an authenticated identity or controlled database operation.
It contains no password, token, cookie, email, or service credential.

Ordinary admin page navigation is not audited. It would add noise without
proving a privileged mutation. Every future admin write must produce durable
audit evidence in the same operation as its state change.

## Threat Model

### Assets And Trust Boundaries

Protected assets include platform-admin authority, tenant/customer data,
capability-link evidence, audit history, service-role credentials, and future
platform operations. Trust boundaries are the browser/server boundary, the
normal authenticated Supabase client/database boundary, the service-role
boundary, and the database-control-plane bootstrap boundary.

| Threat                                        | Severity | Current mitigation                                                                        | Residual action                                                     |
| --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Ordinary user self-promotes                   | Critical | No table privileges or policies; self-scoped read-only RPC; metadata ignored              | Keep live insert/update and metadata-forgery tests                  |
| One or many business owners reach admin       | Critical | Separate tables, helpers, route layout, and role types                                    | Never call `requireBusinessRole` for platform authority             |
| Client forges role/status or user ID          | High     | Server parses authoritative RPC result and matches current Auth user ID                   | Keep role/status allowlist small and fail closed                    |
| Disabled admin retains access                 | Critical | `ACTIVE` predicate is checked on every admin render; no long-lived admin claim            | Add forced session termination before high-risk writes if required  |
| Stolen authenticated admin session            | Critical | Normal Supabase session validation and immediate DB status recheck                        | Require Supabase MFA/AAL policy before privileged write phases      |
| Service-role key leaks to browser or logs     | Critical | Existing server-only client, static boundary test, no admin guard import                  | Rotate immediately and review access if exposure is suspected       |
| Generic admin query crosses tenant boundaries | Critical | Phase 2 uses one aggregate-only RPC; no generic privileged client or data browser exists  | Require narrow projection/RPC and target-specific tests per feature |
| Aggregate leaks PII or financial data         | High     | RPC returns an allowlisted count object only; static and runtime tests cover its contract | Review every new metric and reject record-level projections         |
| Tenant selection changes global truth         | High     | Overview ignores business context and tests compare two current-business cookies          | Keep platform aggregate functions independent of tenant preference  |
| Destructive mutation lacks audit evidence     | Critical | Destructive actions are absent; admin row changes use DB trigger audit                    | Design audit atomically before enabling each write                  |
| Compromised admin account changes authority   | Critical | No self-service management UI or callable management RPC                                  | Add MFA, re-authentication, dual control, and notifications first   |
| Admin identities are accidentally enumerated  | High     | No browser SELECT; RPC returns only active caller                                         | Preserve grant inspection and anonymous/authenticated tests         |
| Bootstrap is raced or misdirected             | High     | UUID primary key, controlled transaction, independent identity review, audit              | Require change approval and two-person review for production        |
| Audit details expose secrets or personal data | High     | Minimal UUID/status metadata; no page logging                                             | Keep metadata allowlisted and test for secret-shaped fields         |

## MFA And Privileged Assurance

Admin Phase 6A uses native Supabase TOTP. `requirePrivilegedPlatformAdmin()`
accepts only signature-verified Auth claims at AAL2 and a freshly resolved,
matching `ACTIVE` platform-admin row. Password and Google OAuth establish AAL1
unless Supabase reports otherwise. Tenant ownership, client flags, local state,
and current-business cookies cannot satisfy this gate.

Read-only admin pages retain the existing active-admin boundary at AAL1.
`/admin/security` is active-admin-only, dynamic, private/no-store, no-referrer,
and noindex. One verified TOTP factor is sufficient for V1. There is no
self-service factor removal or public recovery bypass. See
`docs/ADMIN_PRIVILEGED_ACTIONS.md` for enrollment, challenge, recovery,
confirmation, reason, and audit rules.

## Future Privileged Mutation Rule

Every proposed platform-admin mutation must define and test:

- eligible role and exact server/database authorization;
- target user, tenant, or platform resource;
- reason capture where appropriate;
- atomic audit event and safe metadata;
- reversible versus irreversible semantics;
- notification and approval implications;
- evidence-preservation and retention implications;
- runtime denial for ordinary, cross-boundary, disabled, and forged callers.

## Deferred High-Risk Capabilities

Admin Phases 1 through 5 deliberately exclude impersonation, destructive mutations,
platform-admin membership administration, hard deletion, billing operations,
staff management, generic record editing, customer-data search, and a general
service-role database browser. Each requires a separate threat model and user
authorization before implementation.

## Planned Admin Phases

- Admin Phase 2: aggregate-only operations overview (verified in production).
- Admin Phase 3: read-only businesses and users (verified in production from PR
  #15 and merge `4437a161`).
- Admin Phase 4: read-only bookings and issues (verified in production from PR
  #17 and merge `edbef26`).
- Admin Phase 5: read-only email operations (verified in production from PR #19
  and merge `52a1820`).
- Admin Phase 6A: MFA and privileged-action framework (implemented; no write).
- Admin Phase 6B: separately reviewed failed-email retry (deferred).
- Admin Phase 7: security and system health.

Phase 6B and Phase 7 are plans, not implementation evidence.

Admin Phase 4 uses four additional operation-specific functions for booking and
issue list/detail. Every function repeats the active-admin assertion, has an
empty search path, is postgres-owned, and exposes no generic SQL or table access.
Lists omit contacts and private text. Detail access is minimized: confirmation
contacts are masked; raw terms, hashes/tokens, booking internal notes, feedback
comments, email recipients/provider IDs/failure payloads are excluded. Issue
description is detail-only. Reads are not audited, and no resolve, cancel,
transition, edit, impersonate, suspend, or delete operation exists.

Admin Phase 5 adds two operation-specific public functions. The directory
function returns bounded status counts, event-type distribution, and one stable
page without recipient/failure fields. Detail returns only masked recipient and
a fixed failure category. Neither exposes content, provider IDs, raw failures,
customer contact evidence, tokens, or secrets. Reads do not mutate or audit the
outbox. `SENT` means adapter/provider acceptance only. Retry and resend remain
Phase 6 privileged writes and require MFA, idempotency, reason, audit, and
external-side-effect design before implementation.

Admin Phase 6A introduces no public database function, migration, outbox write,
or service-role application path. Its authorization matrix denies ordinary and
business-owner AAL2 users, disabled admins at AAL2, and active admins at AAL1;
only an active role-allowed admin at AAL2 passes. Status revocation is evaluated
again on every privileged request. The reusable dialog receives an explicit
server action and cannot dispatch arbitrary client-supplied action names.
