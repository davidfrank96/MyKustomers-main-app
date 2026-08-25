# Platform Admin Feature Boundary

Admin Phase 0/1 provides platform identity parsing, server authorization, and a
protected `/admin` shell. Admin Phase 2 adds aggregate-only read operations.
Admin Phase 3 adds narrow read-only business and user support directories and
details. Admin Phase 4 adds narrow read-only booking and issue operations; it
does not provide mutations. Phase 4 is verified in production from PR #17 and
merge `edbef26`.

## Modules

- `lib/admin/access-policy.ts` owns the explicit role/status parser and role
  comparison. It has no database or browser dependency.
- `lib/admin/server.ts` is server-only and owns `getPlatformAdmin`,
  `requirePlatformAdmin`, and `requirePlatformAdminRole`.
- `app/admin/layout.tsx` authenticates and authorizes before rendering its
  separate platform shell.
- `features/admin/overview.ts` parses the allowlisted aggregate contract and
  derives attention counts without database access.
- `features/admin/directory.ts` strictly parses bounded business/user page and
  detail DTOs and formats provider names.
- `features/admin/operations.ts` parses booking/issue list, filter, and detail
  DTOs and rejects unexpected privileged response fields.
- `features/admin/queries.ts` is server-only and invokes one narrow RPC per
  overview, directory, or detail after platform authorization.
- `app/admin` implements Overview, Businesses, Users, Bookings, and Issues with
  structural loading, safe unavailable/not-found states, and cross-linked
  support details.

## Invariants

- `business_members` never grants platform-admin authority.
- Platform admin authorization never calls `requireBusinessRole`.
- The current-business cookie is irrelevant to `/admin`.
- The guard uses the authenticated caller's self-scoped RPC, not service role.
- Client state, profile metadata, email, and URL parameters are never authority.
- Disabled, malformed, missing, duplicate, and failed lookups deny access.
- Admin writes, customer directory browsing, raw Auth data, and generic database
  browsing are absent.
- Overview values must be identical for every current-business selection.
- Directory values must be identical for every current-business selection.
- User Auth projections expose provider names only, never identity payloads,
  metadata, credentials, tokens, or sessions.
- Booking/issue projections exclude internal notes, raw terms, hashes/tokens,
  private feedback comments, and email recipient/provider/failure payloads.
- Effective booking totals include confirmed add-ons only; child records never
  increase booking row counts.

## Adding A Future Capability

Before adding a page or operation, update `docs/ADMIN_SECURITY.md` with its
assets, authorization, audit, disclosure, and revocation analysis. Implement a
narrow server-only query or RPC after `requirePlatformAdminRole`; do not expose a
generic service-role client. Add unit/static coverage and live denial/positive
tests at the runtime-security and E2E layers appropriate to the risk.

Do not add dead navigation. Only implemented destinations belong in the admin
shell.
