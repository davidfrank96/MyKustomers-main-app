# Platform Admin Feature Boundary

Admin Phase 0/1 provides platform identity parsing, server authorization, and a
minimal protected `/admin` shell. It does not provide business-data operations.

## Modules

- `lib/admin/access-policy.ts` owns the explicit role/status parser and role
  comparison. It has no database or browser dependency.
- `lib/admin/server.ts` is server-only and owns `getPlatformAdmin`,
  `requirePlatformAdmin`, and `requirePlatformAdminRole`.
- `app/admin/layout.tsx` authenticates and authorizes before rendering its
  separate platform shell.
- `app/admin/page.tsx` is the only implemented admin destination.

## Invariants

- `business_members` never grants platform-admin authority.
- Platform admin authorization never calls `requireBusinessRole`.
- The current-business cookie is irrelevant to `/admin`.
- The guard uses the authenticated caller's self-scoped RPC, not service role.
- Client state, profile metadata, email, and URL parameters are never authority.
- Disabled, malformed, missing, duplicate, and failed lookups deny access.
- Admin writes and broad platform-data reads are absent from this phase.

## Adding A Future Capability

Before adding a page or operation, update `docs/ADMIN_SECURITY.md` with its
assets, authorization, audit, disclosure, and revocation analysis. Implement a
narrow server-only query or RPC after `requirePlatformAdminRole`; do not expose a
generic service-role client. Add unit/static coverage and live denial/positive
tests at the runtime-security and E2E layers appropriate to the risk.

Do not add dead navigation. Only implemented destinations belong in the admin
shell.
