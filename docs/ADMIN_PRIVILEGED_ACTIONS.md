# Admin Privileged Actions

Status: ADMIN PHASE 6B IMPLEMENTED - PRODUCTION DEPLOYMENT VERIFICATION PENDING

This document defines the security framework for platform-admin mutations and
the one separately approved Phase 6B action.

## Permanent Invariant

No privileged platform-admin mutation may be implemented without explicit
server-side `ACTIVE` admin authorization, the required Supabase Auth assurance
level, action-specific validation, application-owned confirmation, durable audit
evidence, and regression coverage.

Admin reads continue to use `requirePlatformAdmin()` or
`requirePlatformAdminRole()`. Privileged writes must use
`requirePrivilegedPlatformAdmin()`. An `ACTIVE SUPER_ADMIN` at AAL1 may read the
implemented admin surfaces but cannot pass the privileged gate. AAL2 without an
active platform-admin row grants no platform authority.

## Native MFA

The framework uses Supabase Auth TOTP. It does not store OTP secrets, codes,
factors, sessions, or recovery material in application tables. `/admin/security`
uses the supported enrollment, factor-list, challenge/verify, unenrollment, and
assurance APIs. Only a successfully verified TOTP factor counts as configured.

The enrollment QR and manual setup key exist only in transient browser state
while setup is open. They must never enter logs, screenshots, audit metadata,
analytics, shared caches, or repository files. The route is dynamic and sends
private no-store, no-referrer, and noindex headers.

One verified TOTP factor is sufficient for V1. The UI reports the verified
factor count but does not provide a broad factor-management surface. It clears
an abandoned unverified TOTP factor before a new setup attempt. Self-service MFA
removal is deferred because production currently has one approved super admin.

## Server Gate

`requirePrivilegedPlatformAdmin()` derives identity and current AAL from
signature-verified Supabase claims. It then resolves the caller's current
database-backed platform-admin record. The decision requires all of:

1. authenticated Supabase user;
2. one matching `ACTIVE` platform-admin record;
3. an allowed platform role;
4. current session assurance `aal2`.

Client fields such as `role`, `aal`, or `mfaVerified` are ignored. Admin status
is resolved on each privileged request, so disabling an admin defeats an
already elevated session. Tenant role and current-business state are irrelevant.

## Challenge Behavior

When an active admin is at AAL1, privileged actions must return the controlled
`MFA_REQUIRED` state and guide the admin to `/admin/security`. They must not turn
this into an unexplained authorization error. After native challenge/verify,
Supabase refreshes the session and the server must independently observe AAL2.
Logout clears the Supabase session; no application-level MFA flag persists.

Supabase's Auth challenge/verify rate limit is authoritative. The application
does not add an unlimited custom OTP endpoint or implement SMS/email MFA.

## Confirmation And Reasons

`PrivilegedActionDialog` is the reusable application-owned confirmation surface.
An explicit server action is passed for each future operation; there is no
generic action-name dispatcher. The dialog supports pending, error,
`MFA_REQUIRED`, success, and optional reason states.

Policies decide whether a reason is required. Required reasons are trimmed,
non-empty, plain text, and limited to 500 characters. The server must repeat
validation. A reason is justification, not authorization.

## Audit Evidence

The typed audit-evidence builder allows only the admin UUID/role, explicit
action, target type and ID, normalized reason, timestamp, and outcome. It has no
arbitrary metadata field, so tokens, TOTP material, cookies, provider secrets,
and email content have no place in the contract.

A future mutation must persist success evidence atomically with its domain
change whenever possible. Failed or denied attempts must never be represented
as successes. Phase 6A does not add audit enum values because it introduces no
privileged domain mutation. Each later action must review its database event and
transaction semantics before implementation.

## Implemented Phase 6B Policy

`RETRY_FAILED_EMAIL` is the only implemented privileged write:

- role: `SUPER_ADMIN`;
- assurance: AAL2;
- target: `EMAIL_EVENT`;
- eligible state: `FAILED` plus matching provider-pinned attempt evidence and a
  proven retryable non-acceptance class;
- explicit confirmation: required;
- reason: required;
- audit and idempotency: required;
- implemented: true.

`FAILED` alone is insufficient. Proven 429, pre-submission connection failure,
and unaccepted 5xx are retryable. Timeout, uncertain network outcome, malformed
response, exception, state-update uncertainty, and unknown failures are
ambiguous and denied. Permanent 4xx, invalid recipient/sender/configuration, and
invalid message data are non-retryable. `SENT`, `PENDING`, and `SENDING` are
always denied.

The action re-reads the event and latest attempt after the AAL2 gate. A
service-role-only RPC locks and checks exact status, attempt count, failure code,
original provider, active admin, and reason before appending an `ADMIN_RETRY`
attempt. Two tabs cannot claim twice. Finalization records either provider
acceptance or the new bounded failure and writes matching audit evidence. The
original provider is retained; there is no fallback.

Permanent invariant: A failed transactional email may be manually retried only
when the system can establish a safe retryable failure class. Ambiguous provider
outcomes must not be retried automatically or through normal admin controls.

## Recovery And Lockout

There is no public MFA bypass or recovery endpoint. If the sole production
super admin loses the authenticator, a verified operator uses the Supabase
control plane or server-side Admin API to identify that exact Auth UUID and
remove only the lost factor. The operator must independently verify identity,
record external change approval, confirm the platform-admin row remains
`ACTIVE`, require fresh login and reenrollment, and retain safe operator evidence.

The operator must never disable MFA globally, change email ownership, create a
second active admin casually, or expose factor/session data. Before factor
removal, terminate or revoke other sessions where supported. After recovery,
verify one approved active super admin, no unexpected factors, successful fresh
authentication, and new TOTP enrollment.

## Separately Reviewed Actions

The framework does not approve arbitrary resend, business or user suspension,
membership mutation, user security changes, booking overrides, ownership
changes, hard deletion, or impersonation. Each needs its own domain validation,
side-effect/idempotency analysis, audit event, runtime fixtures, UI, and explicit
phase authorization.

## Production Verification

A controlled temporary confirmed Auth user and exactly one temporary active
admin row verified the native enrollment, invalid-code, challenge/AAL2,
revocation, logout/login, and repeat-challenge paths against the configured
production-backed project. No business or domain fixture was created. Cleanup
removed the factor, admin row, profile, Auth user, and test-only actor audits
with zero temporary-account leftovers; the approved production admin was not
changed.

PR #27 passed Quality, Tests, Dependency Security, Build, and E2E, with Runtime
Security intentionally skipped by its configured safe-target gate. It merged
conflict-free as `b90ab5f`, the separate `main` CI run passed, and Vercel
deployed that exact commit to Production. Authenticated production smoke verified
the account-security page at AAL1, session refresh, existing admin reads, vendor
onboarding resolution, private/no-store and referrer/index controls, no browser
diagnostics, and no overflow at 390, 768, 1024, or 1440 pixels.

## Phase 7 Read-Only Health

Admin Phase 7 adds no privileged action and does not expand the Phase 6B retry.
`Refresh status` is a read-only server revalidation and does not require AAL2 or
write audit evidence. A health warning never grants repair, provider switching,
admin creation, retry override, or another mutation. Phase 6B remains the only
implemented privileged write and remains production-verification pending.
