# Security Utilities

Shared security helpers belong here only when they are used across more than one
feature. Feature-specific authorization and validation should stay inside its
feature module until reuse is real.

Phase 2 adds safe redirect handling and server-only audit event recording.
Service-role helpers must remain outside client components.

## Application Rate Limits

`rate-limit.ts` is the shared server-only persistent limiter. It uses the
approved `confirmation_rate_limits` PostgreSQL table through service-role-only
atomic RPCs; no process memory is authoritative. `rate-limit-key.ts` derives
64-hex bucket identifiers with HKDF/HMAC-SHA-256 from the already-required
service-role secret and length-prefixed action parts. The database never receives
raw email, IP, capability hash, user, business, resource, or customer values.

Anonymous source identity is only the first syntactically valid
`x-forwarded-for` address from the verified direct Vercel path. Missing/invalid
values share an opaque unavailable-source bucket. Do not add `x-real-ip`, user
agent, IPv6-prefix guessing, client-submitted actor/business IDs, or ordinary
logs/Sentry context. A sampled 1-in-128 request invokes bounded cleanup of at
most 500 inactive buckets older than 48 hours through the indexed `updated_at`
path; it uses no timer or in-memory collection.

Policy and failure behavior are documented in `docs/security.md`. Normal rate
limit outcomes are expected product states, not Sentry exceptions. Only storage
unavailability emits a safe aggregate action/operation warning without a bucket
or identifier.
