# Development

Future contributors and Codex sessions must inspect existing implementation
before adding new abstractions. Prefer the project patterns already present.

## Mandatory Pre-Work

Before implementation:

1. Read `README.md`.
2. Read `docs/MASTER_PLAN.md`.
3. Read `docs/PRODUCT_SPEC.md`.
4. Read `docs/PHASES.md`.
5. Read relevant ADRs in `docs/DECISIONS.md`.
6. Read `docs/security.md`.
7. Read `docs/DATA_MODEL.md` if database work is involved.
8. Read `docs/TESTING.md`.
9. Inspect existing source code.
10. Inspect relevant tests.
11. Inspect git status.
12. Identify the current phase.
13. Identify explicit exclusions.

## Evidence Rules

Documentation is not implementation evidence. Do not report a feature, table,
policy, API, security control, or workflow as implemented merely because a
document describes it.

Use these labels strictly:

- PLANNED: Specified but not necessarily present in code.
- IMPLEMENTED: Repository evidence exists.
- VERIFIED: Repository evidence exists and appropriate verification succeeded.
- IMPLEMENTED - VERIFICATION PENDING: Implementation exists, but a required
  verification dependency or journey remains incomplete.

Rules:

- Reuse shared UI primitives before creating new component styles.
- Keep domain logic out of generic UI components.
- Keep feature-specific logic inside the relevant feature folder.
- Validate external input at server boundaries.
- Do not access the database directly from arbitrary UI components.
- Maintain clear server/client boundaries.
- Avoid premature abstraction and unused helper layers.
- Do not introduce fake product functionality to make screens look complete.
- Avoid hidden feature creep.
- Avoid undocumented schema changes.
- Avoid undocumented architecture changes.
- No feature is complete merely because it compiles.
- Update tests when behavior changes.
- Keep secrets out of source control and browser bundles.
- Keep local email on the no-network adapter by default. Production Brevo and
  Resend credentials must not be pulled into Preview or Development.

## Image Upload Governance

Every future user-image feature must define accepted MIME types/extensions,
maximum input bytes, maximum decoded dimensions/pixels, server-side content
validation, compression, output format and dimensions, maximum persisted bytes,
bucket/path and public/private access model, authorization, replacement cleanup,
and deletion failure behavior. Browser `accept` attributes are hints, not a
security boundary. Do not store raw or unbounded originals by default.

The current business-logo policy constants live in
`features/businesses/logo-policy.ts`: PNG/JPEG/WebP source up to 5 MiB, 6000px
per edge, and 25 MP. `prepareBusinessLogoForUpload` leaves sources at or below
3 MiB unchanged and reduces larger valid sources to a metadata-free,
2048px-or-smaller JPEG/WebP transport file no larger than 3 MiB. The server then
revalidates and emits metadata-stripped WebP with aspect-preserving resize,
512px maximum, and 200 KiB persisted maximum.

Every business-logo creation, replacement, or onboarding upload must use the
same validated, authorized, metadata-stripping, bounded compression pipeline
before persistence. Keep image upload requests bounded but tolerant of slower
mobile networks. Image upload UI must terminate into success or a recoverable
error state. It must never remain indefinitely pending after request failure or
timeout. Reset the native file input after failure while retaining an explicit
same-file retry path, and guard duplicate submissions synchronously.

Vercel Functions have a non-configurable request-body ceiling around 4.5 MB, so
a raw 5 MiB source cannot be posted to the route. The 3 MiB file target leaves
room for multipart overhead. Client preprocessing is a transport optimization
only; server-side decoding, validation, normalization, compression,
authorization, and persisted-size enforcement remain authoritative. A custom
client may bypass the 5 MiB product-selection rule only by sending a server-safe
intermediate under the transport boundary; the dangerous original does not
reach the server.

When diagnosing logo uploads, inspect the browser request and the shared
`/api/businesses/{business_id}/logo` route before changing Storage policy. A
timeout or malformed response must not be treated as authorization evidence;
owner checks and Storage RLS remain authoritative. Never log image bytes,
credentials, or provider internals.

## Documentation Definition Of Done

Documentation is part of definition of done. Every material feature, fix,
migration, contract, architecture, security, dependency, test-strategy, or
user-visible behavior change must update affected documentation in the same
task. No separate documentation pass should normally be required.

Use the change matrix and checklist in `docs/DOCUMENTATION_GOVERNANCE.md`.
Final reports must list updated documentation or explain why none was required.
Do not update every document for trivial edits; update every materially affected
claim, contract, decision, setup instruction, test expectation, and status.

Useful commands:

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
PHASE2_RUNTIME_VERIFICATION=1 PHASE2_SUPABASE_TARGET=development npm run test:security:runtime
npm run test:e2e
npm run build
```

## UX Audit Expectations

Before billing or other expansion phases, preserve the Phase 9.5 baseline:

- Review authenticated flows at 375px, 390px, 430px, 768px, and desktop widths.
- Keep visible product copy in owner/customer language rather than internal
  implementation terminology.
- Keep booking money displayed as natural currency while storing values as
  integer minor units.
- Keep the dashboard operational first; do not replace it with a wall of
  summary metrics.
- Extend the canonical E2E journey when a new phase changes the core workflow.

## Search Interaction

Searchable lists and entity pickers should update from debounced user input
without requiring an explicit Search submission unless a specific workflow
requires manual submission. Use the shared 300 ms debounce by default. Keep
server-rendered list pages URL-authoritative, use replace-style navigation while
typing, preserve compatible filters, reset pagination, and provide labeled clear
and quiet pending states. Do not move tenant data into the browser solely to add
live search; retain the existing server/client data boundary and document any
bounded local picker as deferred scalability work.

## Branch Integration

- Fetch and compare both branch tips and their merge base before reconciliation.
- Prefer a normal merge for already-shared branches; do not rewrite remote
  history for convenience.
- Resolve conflicts file by file. Preserve verified domain/security behavior,
  immutable migrations, current tests, and accurate documentation.
- Run the complete local gate before push, then verify actual GitHub Actions and
  pull-request mergeability before merging to `main`.
- Do not force push `main`, bypass checks, or treat CI as a deployment pipeline.

Required checks, secret configuration, and branch protection recommendations
are documented in `docs/CI.md`.

## Deployment Governance

- Treat GitHub Actions and Vercel as separate boundaries: CI validates code;
  Vercel Git integration deploys reviewed `main` commits.
- A Production deployment must identify its Git commit and pass application-level
  verification after the platform build succeeds.
- Manage runtime values in Vercel environment configuration. Never commit or log
  `.env` values, and never give a server secret a `NEXT_PUBLIC_` prefix.
- Keep Production server secrets out of Preview and Development unless those
  environments receive a separate reviewed access policy.
- Do not add migration execution to install, build, or deployment commands.
- Update `docs/DEPLOYMENT.md` when domains, environment scope, providers,
  deployment ownership, or rollback behavior changes.

## Transactional Email Development

Keep `TRANSACTIONAL_EMAIL_PROVIDER=development` for ordinary local and Preview
work. Opting into Brevo or Resend requires an intentional server-only key and
sender configuration plus a controlled recipient. Never run broad E2E suites
with an external provider pointed at customer addresses. Provider changes must
preserve the durable outbox boundary, no-network default, domain-state failure
isolation, and the tests described in `docs/TRANSACTIONAL_EMAIL.md`.

## Multi-Business Development

- Resolve tenant context with `getCurrentBusinessContext`; do not infer
  `memberships[0]` inside domain actions or database functions.
- Treat the current-business cookie as untrusted preference input. Validate an
  active membership before reading or writing tenant data.
- Pass the resolved `business.id` explicitly into every customer, booking,
  analytics, search, and settings boundary. Keep RLS and exact RPC checks.
- Use `create_business_onboarding` for every new business so the business and
  owner membership remain atomic, then persist the returned UUID as current.
- Keep public `/c`, `/a`, `/x`, and `/f` routes independent from authenticated
  workspace state. Do not use localStorage as tenant authority.

## Cache And Loading Governance

- No cache may be introduced for authenticated or tenant-scoped data without
  explicit cache scope, key, invalidation behavior, and cross-tenant security
  analysis.
- Public capability-token pages must remain non-cacheable unless a future
  security review explicitly changes the rule.
- Request-scoped React server memoization is permitted for stable shared
  functions and arguments. It must not be described as cross-request caching.
- Longer asynchronous route/data transitions should provide structural loading
  feedback without exposing stale tenant data or requiring full-page client
  rendering.
- Loading placeholders must be non-interactive, accessible as one status,
  stable at responsive widths, and reduced-motion safe.

## Navigation Performance Governance

- Measure local production builds and deployed production separately with a
  controlled authenticated account. Prefer repeat medians and preserve cold
  outliers instead of reporting one favorable run.
- Keep Vercel functions close to the Supabase project region. A region change
  must be based on verified provider locations and followed by production
  response-header and application-flow verification.
- Reduce sequential Supabase HTTP round trips through existing RLS-protected
  relations or safe concurrency. Do not trade tenant authority, freshness, or
  projection boundaries for latency.
- Treat broad authenticated RSC prefetch, service-worker data caching, Redis,
  and persistent framework caches as security/design changes requiring measured
  benefit, tenant keys, invalidation, and revocation analysis.
- Performance instrumentation must not log URL query strings, tokens, cookies,
  customer data, emails, credentials, or database URLs. Remove temporary timing
  hooks before release unless permanent telemetry has a reviewed contract.

## Platform Admin Development

- Use `requirePlatformAdmin` or `requirePlatformAdminRole`; never reuse
  `requireBusinessRole` for platform authority.
- Authenticate and authorize before any privileged platform data access.
- Keep platform-admin queries in a server-only, narrow boundary. Do not expose
  service role to client modules or create a generic table accessor.
- Do not use profile metadata, an email allowlist, client state, or business
  ownership as admin authority.
- Keep the admin shell limited to implemented destinations. New pages require
  an authorization, disclosure, audit, runtime-test, and threat-model update.
- Runtime/E2E admin fixtures must use the service-role test boundary and clean
  audit rows, admin rows, tenant fixtures, and Auth users in dependency order.
- Production bootstrap, migration, or deployment requires separate explicit
  approval and the runbook in `docs/ADMIN_SECURITY.md`.

## Live Booking Development

- Keep `/api/bookings/[bookingId]/sync` authenticated, current-business-scoped,
  private/no-store, and free of service-role access or customer content.
- Preserve visibility pause, focus refresh, overlap prevention, abort cleanup,
  revision deduplication, and server-page revalidation when changing polling.
- Do not introduce Realtime publication membership, service-worker tenant
  caching, browser push, or persisted subscriptions without a separate security
  and revocation design.
- Booking communication must create `email_events` in the authoritative domain
  transaction and deliver through `lib/email`; domain features must not import
  Brevo or Resend adapters directly.

## Sentry Development

- Normal local development and CI provide no Sentry DSN, so the SDK is disabled
  and makes no telemetry request.
- Do not add a real DSN or auth token to committed files, test snapshots, logs,
  screenshots, or browser bundles.
- All new capture points must use the shared hooks in
  `lib/observability/sentry.ts`; never attach user, business, customer, booking,
  capability, contact, form, or credential data.
- Expected validation, authorization, conflict, and not-found outcomes remain
  typed product errors, not captured exceptions.
- Temporary verification triggers must be non-public, used minimally, and
  removed before Production.
