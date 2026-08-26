# Platform Admin Feature Boundary

Admin Phase 0/1 provides platform identity parsing, server authorization, and a
protected `/admin` shell. Admin Phase 2 adds aggregate-only read operations.
Admin Phase 3 adds narrow read-only business and user support directories and
details. Admin Phase 4 adds narrow read-only booking and issue operations; it
does not provide mutations. Phase 4 is verified in production from PR #17 and
merge `edbef26`.
Admin Phase 5 adds verified production read-only email operations. Admin Phase
6A adds native TOTP enrollment and the mandatory privileged-write security
framework, but no write operation. It is verified in production from PR #27,
merge `b90ab5f`, controlled temporary-admin runtime evidence, and authenticated
production smoke.
Admin Phase 6B adds exactly one write: an AAL2-gated, reason-required retry of a
safely classified failed email on event detail. It preserves attempt history,
pins the original provider, and cannot alter domain state.

Admin Phase 7 adds read-only Security & Health. It uses one bounded summary RPC,
one bounded allowlisted security-activity RPC, strict minimized DTOs, current
MFA evidence, and safe configuration-presence data. It adds no write and remains
independent of current-business selection.

Email Operations also recognizes `BOOKING_RESCHEDULED` and
`BOOKING_DELIVERED`. Reschedule requests remain non-retryable because the raw
secure URL is intentionally not persisted. This event-type extension does not
change Admin Phase 6B's implementation/production-verification-pending status.

## Modules

- `lib/admin/access-policy.ts` owns the explicit role/status parser and role
  comparison. It has no database or browser dependency.
- `lib/admin/server.ts` is server-only and owns `getPlatformAdmin`,
  `requirePlatformAdmin`, `requirePlatformAdminRole`, and the stricter
  `requirePrivilegedPlatformAdmin` AAL2 gate.
- `lib/admin/privileged-access-policy.ts` owns the pure authorization matrix,
  bounded reason schema, implemented retry action policy, and allowlisted audit
  evidence.
- `features/admin/security.ts` parses factor/assurance metadata, while
  `features/admin/security-server.ts` protects the status read.
- `app/admin/security` and `components/admin/admin-mfa-security.tsx` implement
  Supabase-native TOTP enrollment/challenge without persisting the secret.
- `components/admin/privileged-action-dialog.tsx` provides reusable explicit
  confirmation and optional reason UX for concrete future server actions.
- `app/admin/layout.tsx` authenticates and authorizes before rendering its
  separate platform shell.
- `features/admin/overview.ts` parses the allowlisted aggregate contract and
  derives attention counts without database access.
- `features/admin/directory.ts` strictly parses bounded business/user page and
  detail DTOs and formats provider names.
- `features/admin/operations.ts` parses booking/issue list, filter, and detail
  DTOs and rejects unexpected privileged response fields.
- `features/admin/email-operations.ts` parses bounded email summary, directory,
  and detail DTOs and derives controlled operational health and retry labels.
- `features/admin/health.ts` strictly parses minimized summary/activity DTOs and
  derives deterministic `OPERATIONAL`, `ATTENTION`, `DEGRADED`, and `UNKNOWN`
  states.
- `features/admin/health-server.ts` performs the two authenticated RPC reads and
  reports deployment/configuration presence without exposing values.
- `lib/email/retry-policy.ts` is the authoritative retryability classifier and
  attempt-scoped idempotency-key builder.
- `features/admin/email-retry-actions.ts` is the concrete server action. It
  repeats AAL2/current-authority checks, re-derives event evidence, and invokes
  only the original provider after an atomic claim.
- `features/admin/queries.ts` is server-only and invokes one narrow RPC per
  overview, directory, or detail after platform authorization.
- `app/admin` implements Overview, Businesses, Users, Bookings, Issues, Email
  Operations, and Security & Health with structural loading, safe unavailable
  states, independent source-failure rendering, and cross-linked support details.

## Invariants

- `business_members` never grants platform-admin authority.
- Platform admin authorization never calls `requireBusinessRole`.
- The current-business cookie is irrelevant to `/admin`.
- The guard uses the authenticated caller's self-scoped RPC, not service role.
- Client state, profile metadata, email, and URL parameters are never authority.
- MFA does not create platform authority; privileged writes require both a
  current active admin record and signature-verified AAL2.
- Disabled, malformed, missing, duplicate, and failed lookups deny access.
- Admin writes other than the single failed-email retry, customer directory
  browsing, raw Auth data, and generic database browsing are absent.
- Overview values must be identical for every current-business selection.
- Directory values must be identical for every current-business selection.
- Security & Health values must be identical for every current-business
  selection, and unavailable evidence must never become green.
- User Auth projections expose provider names only, never identity payloads,
  metadata, credentials, tokens, or sessions.
- Booking/issue projections exclude internal notes, raw terms, hashes/tokens,
  private feedback comments, and email recipient/provider/failure payloads.
- Effective booking totals include confirmed add-ons only; child records never
  increase booking row counts.
- Email directories expose no recipient or failure fields. Detail exposes only
  masked recipient, controlled failure category, safe attempt history, and
  server-derived retry eligibility; content, provider IDs, and raw failures
  remain absent.
- There is no self-service MFA removal, generic action dispatcher, arbitrary or
  bulk resend, automatic/provider-fallback retry, suspension, deletion,
  membership mutation, or impersonation.

## Adding A Future Capability

Before adding a page or operation, update `docs/ADMIN_SECURITY.md` and
`docs/ADMIN_PRIVILEGED_ACTIONS.md` with its
assets, authorization, audit, disclosure, and revocation analysis. Implement a
narrow server-only query or RPC after the appropriate read or privileged-write
guard; do not expose a generic service-role client. Add unit/static coverage and
live denial/positive tests at the runtime-security and E2E layers appropriate to
the risk.

Do not add dead navigation. Only implemented destinations belong in the admin
shell.
