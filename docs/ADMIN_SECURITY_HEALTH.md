# Admin Security & Health

Implementation state: VERIFIED - PRODUCTION.

Admin Phase 7 adds minimized, read-only platform health visibility at
`/admin/security`. It does not turn My Kustomers into an infrastructure console
and adds no privileged mutation.

## Permanent Boundary

> Admin Security & Health provides minimized read-only operational and security
> visibility. Detection of an anomaly does not itself authorize remediation or
> bypass the privileged-action framework.

Unavailable or unmeasured evidence must be represented as unknown rather than
healthy.

Administrative health surfaces may report configuration state but must never
expose credential values, session material, capability tokens, or provider
secrets.

## Authorization

- Every page and server query requires `requirePlatformAdmin()`.
- Each database RPC independently calls
  `private.require_platform_admin_read_access()`.
- Anonymous callers, ordinary users, business owners, and disabled platform
  admins are denied.
- An active platform admin may read health at AAL1 or AAL2. AAL2 remains
  mandatory for the separately reviewed Phase 6B failed-email retry.
- Browser properties, profile metadata, role strings, and the current-business
  cookie provide no platform authority.
- The page never uses a service-role client.

## Health States

- `OPERATIONAL`: all currently measured core dependencies and required
  configuration checks passed, no non-informational attention condition exists,
  and required security-activity evidence is available.
- `ATTENTION`: core services remain available, but an operational or account
  resilience condition needs review, such as failed/stale email, open booking
  issues, missing MFA, or only one active platform administrator.
- `DEGRADED`: a required application configuration category is missing or the
  bounded database health summary cannot be read.
- `UNKNOWN`: a required signal cannot currently be measured without evidence of
  a known core-service failure. Missing telemetry is never converted to green.

Overall aggregation is deterministic: `DEGRADED` takes precedence over
`UNKNOWN`, which takes precedence over `ATTENTION`, then `OPERATIONAL`.
Operational workload such as overdue bookings remains informational and is not
presented as a cybersecurity event.

## Signal Inventory

| Signal                            | Source                                        | Freshness        | Sensitivity | Display rule                                                            |
| --------------------------------- | --------------------------------------------- | ---------------- | ----------- | ----------------------------------------------------------------------- |
| Database minimal read             | live authorized RPC                           | request time     | low         | operational only after the bounded read succeeds                        |
| Admin authorization               | live session and database authority           | request time     | high        | current admin status only; no UUID in normal UI                         |
| MFA status                        | live Supabase factor/session evidence         | request time     | high        | factor presence and human-readable assurance only                       |
| Email counts and ages             | database-derived outbox/attempt aggregates    | request time     | medium      | counts/timestamps only; no recipient, body, provider ID, or raw failure |
| Booking issues/overdue work       | database-derived aggregates                   | request time     | medium      | counts and oldest timestamps only                                       |
| Platform-admin counts             | database-derived aggregate                    | request time     | high        | active/disabled counts only                                             |
| Security activity                 | bounded allowlisted audit evidence            | request time     | high        | up to 20 events with allowlisted actor/target/reason/result fields      |
| Runtime environment/domain/commit | deployment/configuration-derived              | process lifetime | low         | names/presence only; values are never enumerated                        |
| Brevo/Resend configuration        | configuration-derived                         | process lifetime | high        | configured/missing only; no live provider probe or secret value         |
| Auth email/OAuth                  | historically verified/manual release evidence | release time     | high        | explicitly not presented as a live page-load probe                      |

`SENT` email state means accepted by the configured provider. It does not prove
recipient delivery, opening, or reading. Resend is configured standby, not a
live failover health claim.

## Database Contract

Migration `20260826195655_admin_phase_7_security_health.sql` adds only:

- `public.get_platform_admin_health_summary()`;
- `public.get_platform_admin_security_activity(integer)`.

Both functions are stable, postgres-owned, `SECURITY DEFINER`, use an empty
`search_path`, repeat the active-admin assertion, revoke execution from PUBLIC
and `anon`, and grant the intended browser execution boundary to
`authenticated`. They do not change tables, rows, indexes, RLS policies, domain
enums, or existing grants.

The health summary reads bounded aggregates from `email_events`,
`email_delivery_attempts`, `booking_issues`, `bookings`, and
`platform_admins`. Security activity first selects at most 20 allowlisted audit
rows in stable newest-first order, then joins actor labels in one bounded query.
No N+1 actor lookup is used.

## Query Budget And Caching

One page render uses at most:

1. one health-summary RPC;
2. one recent-security-activity RPC;
3. existing current-admin MFA/session evidence.

The page is dynamic and private. Server request memoization may deduplicate a
read, but cross-user/shared CDN and service-worker caching are prohibited. There
is no automatic polling. `Refresh status` re-renders the server data and disables
duplicate interaction while pending.

On 2026-08-26, production read-only `EXPLAIN (ANALYZE, BUFFERS)` checks under the
approved active-admin claim measured 18.006 ms for the health summary and
51.864 ms for 12 recent security events. Both were shared-buffer reads with no
write blocks. Supabase Performance Advisor reported zero errors and zero
warnings after migration. No speculative index was added.

## Outbox And Integrity Rules

An outbox event is stale after 15 minutes in `PENDING` or `SENDING`. This matches
the existing delivery-claim operational window. Stale evidence is an attention
signal only; the page never sends, retries, deletes, or changes an event.

The deliberately preserved historical pending event remains visible as truthful
attention evidence. It is not replayed, retried, failed, or deleted by Phase 7.

Foreign-key invariants are not redundantly scanned on every request. The page
uses only precise, inexpensive checks that can reveal operationally possible
states. It performs no self-healing and creates no page-view audit noise.

## Security Activity

The initial allowlist is:

- platform administrator created, updated, or disabled;
- failed-email retry requested;
- failed-email retry accepted by provider;
- failed-email retry failed.

The DTO can contain a safe platform-admin display label/email where justified,
event type, timestamp, target type/reference, bounded retry reason, and result.
It cannot contain customer contact, email body/recipient, booking private text,
raw metadata/failure, tokens, cookies, TOTP material, sessions, or secrets.
Routine page views and anonymous/crawler denials are not security activity.

## Current Limitations

Phase 7 does not provide:

- historical uptime measurement or an SLA claim;
- a SIEM or live vulnerability scanner;
- dependency CI status inside the application;
- live Google OAuth or Auth-email probing on page load;
- provider-delivery, bounce, complaint, or inbox guarantees;
- production field RUM/Core Web Vitals;
- Sentry event detail, alert management, or live third-party provider status in
  the in-app admin surface;
- automatic remediation or infrastructure controls;
- provider switching, automatic retries, bulk retry, or failover;
- account/business suspension, membership mutation, impersonation, or deletion.

Dependency security remains a CI/release signal. Auth, provider, DNS, and email
delivery checks remain controlled release procedures. Future monitoring,
incident response, bounce webhooks, scheduled retry, provider failover, backup
exercises, additional admin roles, and field telemetry require separate product
and security review.

Sentry is now implemented as a separate external error-and-trace boundary. It
does not change `/admin/security`, provide a live green health probe, expose
credentials, or authorize remediation. Production Sentry event/source-map
verification remains governed by `docs/SENTRY.md`.

## Verification Rules

- No Docker or local Supabase stack.
- No destructive production fixtures or changes to the sole real admin.
- Direct runtime checks against production are read-only.
- Fixture-based runtime tests run only against an explicitly safe non-production
  backend and otherwise skip by design.
- Production smoke compares displayed aggregate values with authoritative
  read-only database evidence and confirms no write side effects.
- Admin Phase 6B remains `IMPLEMENTED - VERIFICATION PENDING` until its separate
  controlled AAL2 provider retry is genuinely completed.

Production verification completed through PR #39 and merge `d5bfb8f`. All
required executable CI checks passed, with Runtime Security retaining its
expected protected-target skip, and Vercel deployed the exact merge to
Production. Authenticated `mykustomers.com` smoke covered every admin
destination, manual refresh, clean browser diagnostics, and current aggregate
agreement with a separate read-only Supabase query. The exact deployed code also
passed the 390, 768, 1024, and 1440 pixel E2E containment matrix. No production
row or fixture was created or changed, and Docker/local Supabase was not used.

The planned foundational admin roadmap is complete. No Admin Phase 8 is implied.
