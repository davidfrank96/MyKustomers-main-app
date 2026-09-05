# Sentry Production Observability

## Brevo Webhook Privacy Boundary

Unexpected provider-evidence persistence failures may report only fixed provider,
event-category, failure-category, release, and environment values. The webhook
route must not send recipient, subject, body, provider message ID, arbitrary
provider diagnostics, raw callback JSON, authorization headers, or webhook secret
to Sentry. Authentication denials, schema rejections, unsupported events, and
idempotent duplicates are expected outcomes and are not reported as issues.

Implementation state: IMPLEMENTED - PRODUCTION VERIFICATION PENDING.

My Kustomers uses the official `@sentry/nextjs` SDK for production error
monitoring and conservative performance tracing. Sentry is an external
operational tool, not a product analytics, customer-support, or authorization
system.

## Runtime Architecture

The App Router integration uses:

- `instrumentation-client.ts` for browser initialization and router-transition tracing;
- `sentry.server.config.ts` for the Node server runtime;
- `instrumentation.ts` for server registration and Next.js request-error capture;
- `app/global-error.tsx` plus the existing admin error boundary for caught React render failures;
- `next.config.ts` for build-time instrumentation, release association, and private source-map upload.

The application currently has no Edge route/runtime, so it has no unused Edge
Sentry configuration. Adding Edge execution requires a matching reviewed SDK
configuration.

## Enabled And Excluded Products

Enabled:

- unhandled/captured errors at `sampleRate: 1`;
- page-load, server-request, and route-transition tracing at 5%;
- release identification from the Vercel Git commit;
- build-time source-map upload when `SENTRY_AUTH_TOKEN` is present.

Explicitly disabled or absent:

- Session Replay, Sentry user feedback, and profiling;
- Sentry logs and metrics;
- automatic cron monitors and client event tunnels;
- automatic user identity and local-variable capture;
- request/response bodies, headers, cookies, and query parameters.

`/api/health` is excluded from tracing. Real errors are not down-sampled.
Routine transactions use 5%, selected after the 2026-08-27 account inspection
showed a Business trial with zero usage, a current allowance of 1,000,000 error
events and 100,000,000 spans, and 14 trial days remaining. Reassess this rate
against the post-trial plan and real traffic; never raise it blindly to 100%.

## Privacy Boundary

`lib/observability/sentry.ts` is the single event-sanitization policy. It:

- removes Sentry user objects, arbitrary extras, request headers, cookies, bodies, and query strings;
- redacts raw `/c`, `/a`, `/x`, and `/f` capability values everywhere Sentry receives strings;
- removes identity/contact, tenant, booking, customer, search, feedback, token, credential, and content fields;
- drops console and text-bearing UI breadcrumbs;
- allowlists bounded navigation/HTTP breadcrumb and span fields;
- fails closed for error/transaction events if sanitization itself fails.

Do not call `Sentry.setUser`, attach business/customer/booking identifiers, send
form state, or bypass these callbacks. Expected validation, authorization,
not-found, conflict, and provider-domain outcomes remain normal application
results; they are not exceptions merely because Sentry exists.

Sentry project defenses are also enabled: default and server-side scrubbers,
IP-address storage prevention, 26 additional sensitive field-name scrubbers,
and an origin allowlist limited to `mykustomers.com`, `www.mykustomers.com`, and
the retained Production Vercel hostname. Sentry JavaScript source fetching is
disabled; uploaded source maps are authoritative.

## Environment Variables

Production-only runtime/build configuration:

| Name                     | Secret | Purpose                                             |
| ------------------------ | ------ | --------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | No     | Browser event ingestion endpoint.                   |
| `SENTRY_DSN`             | No     | Server event ingestion endpoint.                    |
| `SENTRY_AUTH_TOKEN`      | Yes    | Build-only release/source-map upload. Never public. |
| `SENTRY_ORG`             | No     | Sentry organization slug.                           |
| `SENTRY_PROJECT`         | No     | Sentry project slug.                                |

The DSN is public routing configuration, not an auth token. The auth token must
have only the permissions required by the bundler upload workflow, must never
use a `NEXT_PUBLIC_` prefix, and must remain in Vercel secret configuration.
Preview and Development do not receive these values by default. Without a DSN,
the SDK is disabled; normal local development and CI therefore send nothing.

## Source Maps And Releases

`withSentryConfig` enables source-map generation/upload only when the build has
`SENTRY_AUTH_TOKEN`. Uploaded maps are deleted from generated deployment
artifacts, and no `.map` file is emitted under `.next/static` in ordinary local
builds. Builds use `VERCEL_GIT_COMMIT_SHA` as the release when available.

A production release is not verified until Sentry shows the deployed commit and
a controlled event resolves to readable application source. A code build may
pass without the token, but that does not prove production source maps.

## Alerting And Operations

The project currently has Sentry's default high-priority issue email alert and
spike protection. No second alert was created during initial setup. Review real
noise and regression patterns before adding rules; do not alert on every event
or configure external destinations without separate authorization.

Sentry acceptance means telemetry reached Sentry. It does not prove customer
impact, uptime, email delivery, database correctness, or incident resolution.
The in-app Admin Security & Health page remains an independent read-only surface
and does not expose Sentry credentials or mutate Sentry.

## Verification

Required before claiming Production verification:

1. Run lint, typecheck, unit/integration/security tests, E2E, build, dependency audit, and `git diff --check`.
2. Confirm no Sentry auth token or credential value exists in Git/client bundles.
3. Build/deploy through the normal PR, required CI, merge, and Vercel flow.
4. Confirm source maps and release association in Sentry.
5. Trigger at most one harmless controlled client error and one controlled server error through a non-public temporary verification mechanism.
6. Inspect received evidence for environment, release, readable frames, and absent private data.
7. Remove the temporary trigger before Production and verify ordinary product flows plus browser diagnostics.

Focused regression coverage lives in
`tests/unit/sentry-observability.test.ts` and
`tests/security/sentry-observability-boundary.test.ts`.

## Limitations

This integration is not full uptime monitoring, a SIEM, vulnerability scanning,
field-quality Core Web Vitals RUM, Session Replay, log aggregation, or automatic
incident remediation. Sentry plan/quota changes, retention, ownership, and
incident response remain operational governance work.
