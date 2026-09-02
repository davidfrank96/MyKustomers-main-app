# Deployment

STATUS: VERIFIED

## Current Production

- Platform: Vercel
- Account/team: `David Frank's projects`
- Project: `my-kustomers-main-app`
- Repository: `davidfrank96/MyKustomers-main-app`
- Production branch: `main`
- Canonical URL: `https://mykustomers.com`
- Redirect URL: `https://www.mykustomers.com` -> canonical apex
- Retained Vercel URL: `https://my-kustomers-main-app.vercel.app`
- Function region: London, `lhr1` (aligned with Supabase AWS `eu-west-2`)
- Initial verified application commit: `ab90ebc4e808bfba64ce0c13a3db757a629b806b`
- Initial verified deployment: `CDxVhdJyQ1Lnt6AGm7cXuct9YcTE`
- Navigation performance commit: `e3c6e5b1e406d0ee8f5ee48c3526bf2ff43fdfdb`
- Navigation performance deployment: `dpl_554b3B9TtEUUw1a84vgUNPmDmZg4`
- Authenticated Navigation V2 merge commit:
  `d2f55fd4ec06b78ae45e435d35431f59f22ea515`
- Authenticated Navigation V2 deployment: `C5vYEdBCGV95PHPkjybFiNX9te4b`
- Auth lifecycle/load-more merge commit:
  `49dbd51075f3a3dd837e39cfa919f42ac9c29a80`
- Auth lifecycle/load-more deployment: `A9YGEEK3nBXnPW1M3vS81s5mHmXf`

The V2 deployment completed in 49 seconds, reported `Ready`, `Latest`,
`Production`, and `Current`, and served `mykustomers.com` before controlled
desktop, mobile, standalone, Nigeria-profile, and responsive smoke checks ran.
No environment variable, database, provider, or infrastructure change was part
of this deployment.

The auth lifecycle/load-more deployment reported `Ready` for `main` and
Production after PR #51's required checks passed. Canonical-domain smoke verified
the real Google chooser boundary, email confirmation and password recovery,
provider-independent onboarding, old/new password behavior, reused-link safety,
and bounded Bookings/Customers loading across desktop and mobile. All controlled
Auth and tenant fixtures were removed, and an independent production query
returned zero residue.

Vercel Git integration creates Production deployments from `main`. Pull requests
and feature branches may create Preview deployments, but the current project
intentionally gives Preview no Supabase or service-role environment values.
GitHub Actions remains the required code-quality gate; it does not call Vercel
or mutate infrastructure.

The initial online application uses the existing development Supabase project.
This is an explicit early-deployment limitation, not a production database
promotion. Runtime-security tests and migration administration must continue to
target an explicitly identified safe environment.

## Delivery-To-Feedback Migration And Rollback

The Production-backed database already contains exact migration
`20260901194500_delivery_feedback_automation.sql` with SHA-256
`7ad964608538057bd041b745fa7005e7cb75a7e01264dade2a41ef48b8071ba7`.
It also contains the exact temporary compatibility migration
`20260901205018_delivery_feedback_legacy_compatibility.sql` with SHA-256
`183af91b911c97e77717a60f8f9f9c1f23e6432dffed2a1b88a4d8d6b44009bb`.
The latter changes only the two deferred delivery-association functions so the
currently deployed legacy RPC can continue producing exactly one null-associated
delivery event during rollout. Every non-null association remains strict.
Before application deployment, the named Vault secret
`mykustomers_feedback_capability_hmac_v1` must exist exactly once and remain
database-managed; no Vercel environment variable is added for it. Vercel builds
must not apply or rotate this migration or secret.

The migration is additive and backward-compatible with historical version 0
links. For an application regression, promote the last compatible Vercel
deployment and retain the columns, functions, constraints, and Vault secret.
Do not delete the secret, reverse the immutable migration, zero token versions,
unlink delivery events, or attempt a destructive down migration. Any database
correction requires a separately reviewed forward migration. Rotation or secret
loss requires an explicit capability migration/rotation design because existing
version 1 links depend on the current key.

Production application verification must use newly created controlled fixtures
and a controlled recipient, never replay a historical outbox row. It must prove
the real delivery CTA, feedback-before-payment and payment-before-feedback
completion orderings, manual recovery of the same link, retry/horizon behavior,
and independent zero-residue cleanup before the release is called verified.
After all Production instances use `deliver_booking_with_feedback`, record the
deployment convergence timestamp and post-convergence event/null-association
counts. Only then may the separately reviewed tightening migration be approved;
it must never be applied as part of the compatibility or application rollout.

That application verification completed on PR #56 merge `1dd7aed` and Vercel
Production deployment `dpl_9mykhqy4erja6aiDLzybk2jjAK5U`. Canonical health and
runtime logs were clean. Two controlled Brevo-backed deliveries passed exact
CTA/manual link identity and both completion orderings, then cleanup returned
zero tenant/Auth/audit residue. From the `2026-09-01 22:21:08+00` convergence
cutoff, the pre-cleanup sample contained two delivery events, zero null
associations, and two version 1 associations. Migration
`20260901230527_delivery_feedback_require_v1_association.sql` has SHA-256
`397dbaaa6fab4fb78902e13ef3273054d629df2316bfd0dd593d210d7cb9e6c4` and was
explicitly approved and applied transactionally after PR #57 merged as
`59c7e81`. The immediate precondition found zero invalid post-cutoff
associations. Post-apply catalog checks confirmed both strict functions,
postgres ownership, empty search paths, and revoked execution for PUBLIC,
anon, authenticated, and service_role. Rollback-only verification rejected the
legacy null path and accepted the current exact-v1 RPC path with no persisted
fixture data.

## Production Environment

Vercel Production contains these required runtime variables:

| Name                                   | Boundary      | Scope      | Purpose                                 |
| -------------------------------------- | ------------- | ---------- | --------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Public        | Production | Stable absolute application URL         |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public        | Production | Supabase API origin                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public        | Production | Browser-safe Supabase key               |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server secret | Production | Narrow server-only privileged workflows |
| `TRANSACTIONAL_EMAIL_PROVIDER`         | Server config | Production | Select Brevo; no automatic failover     |
| `TRANSACTIONAL_EMAIL_FROM`             | Server config | Production | Verified sender identity                |
| `BREVO_API_KEY`                        | Server secret | Production | Active transactional provider API       |
| `RESEND_API_KEY`                       | Server secret | Production | Scoped standby provider API             |

Vercel stores API/service credentials as Secret and provider/sender selection as
Config. The service-role and provider keys have no `NEXT_PUBLIC_` prefix and
must never be read by a Client Component or included in browser output. Values
are managed only in Vercel's environment-variable
configuration and are never committed, printed in logs, or copied into this
document.

The following local/test names are deliberately not deployed:

- `DATABASE_URL`, `DIRECT_URL`, `DATABASE_POOLER_URL`, `SUPABASE_DB_URL`
- `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `E2E_SIGNUP_EMAIL`
- `PHASE2_RUNTIME_VERIFICATION`, `PHASE2_SUPABASE_TARGET`

The running application uses Supabase APIs rather than a direct PostgreSQL
connection. Database administration credentials and test controls therefore do
not belong in the Vercel runtime.

## Supabase Auth

The Supabase Auth URL configuration for the canonical production domain is:

- Site URL: `https://mykustomers.com`
- Allowed redirect: `https://mykustomers.com/auth/callback`
- Allowed redirect: `https://mykustomers.com/auth/callback?next=/dashboard`
- Allowed redirect: `https://mykustomers.com/auth/callback?next=/reset-password`
- Allowed redirect: `https://my-kustomers-main-app.vercel.app/auth/callback?next=/dashboard`
- Allowed redirect: `https://my-kustomers-main-app.vercel.app/auth/callback?next=/reset-password`

These are exact URLs. No Preview wildcard is configured. Add another exact
domain only when that environment has a reviewed Supabase access policy.

Google OAuth application support uses the existing dashboard callback above.
The configured project's public Auth settings report Google enabled. Provider
credentials remain configured only in Supabase Auth:

- Google OAuth Web Client ID
- Google OAuth Client Secret

Google Cloud must authorize this Supabase-owned redirect URI:
`https://xtwzdgxbnlplsvcnmeje.supabase.co/auth/v1/callback`.
The application production origin must remain an authorized JavaScript origin,
and the exact Vercel callback above must remain in Supabase Redirect URLs. Do not
add a broad Production or Preview wildcard. Local verification also requires the
exact callback generated by the app:
`http://localhost:3000/auth/callback?next=/dashboard`.

The 2026-08-24 runtime check completed the unassisted Google journey through
`http://localhost:3000/auth/callback?next=/dashboard` after the development
localhost allowlist was activated. It established an application session and
exercised zero, one, and multiple-business routing, switching, refresh
persistence, and logout without manual code forwarding.

Google requires no new Vercel variable: provider credentials belong in Supabase,
not `NEXT_PUBLIC_*`, source control, deployment logs, Preview, or Development.
New-user profile/onboarding, session persistence, logout, existing and
multi-business routing, and switching have controlled local runtime evidence.
Required CI passed, the merge deployed successfully to Vercel, and production
Google OAuth repeated the callback, multi-business resolution, switching,
persistence, logout, and protected-route checks. Same-email identity behavior
remains a separate lifecycle check.

An intentional Google start passes the supported `prompt=select_account`
provider query parameter. This gives the user an account choice while allowing
Google to reuse prior consent; `prompt=consent` is not forced. Provider
authentication and the PKCE code exchange complete before the shared
profile/membership resolver may present onboarding or a workspace.

Password recovery continues to use Supabase Auth email through the configured
Brevo SMTP transport. The exact `/auth/callback?next=/reset-password` callback
takes precedence over stale OAuth destination state, sets a ten-minute
HTTP-only intent scoped to `/reset-password`, and requires both that intent and
an authenticated recovery session before updating a password. Success consumes
the intent, signs the application session out, clears workspace preferences,
and returns to Login. No recovery code or token belongs in UI, analytics,
Sentry, or application logs.

## Email State

Supabase Auth continues to own signup-confirmation and password-recovery email.
Customer booking, cancellation, amendment, and add-on events use the durable
application outbox. Production is configured to select Brevo after the reviewed
`main` deployment. Resend is configured as standby only. Provider selection
never submits one event to both providers and has no automatic failover.

Do not describe an outbox event as customer delivery. Brevo reports the root
domain and My Kustomers sender verified; Resend reports its standby domain
verified. One new controlled booking-confirmation event was accepted by Brevo,
reached the controlled inbox, and appeared in Admin Email Operations after the
reviewed deployment. Active names are:

| Name                           | Boundary             | Scope      | Purpose                                 |
| ------------------------------ | -------------------- | ---------- | --------------------------------------- |
| `TRANSACTIONAL_EMAIL_PROVIDER` | Server configuration | Production | Select `brevo`                          |
| `BREVO_API_KEY`                | Server secret        | Production | Authenticate direct transactional sends |
| `TRANSACTIONAL_EMAIL_FROM`     | Server configuration | Production | Verified sender identity                |
| `RESEND_API_KEY`               | Server secret        | Production | Standby direct transactional sends      |

Do not copy these values into Preview or Development, use a
`NEXT_PUBLIC_BREVO_API_KEY`, or expose values during configuration. Never replay
historical events. Roll back delivery by restoring the prior Production provider
selection or removing external-provider configuration, then redeploy. Resend is
not automatically invoked after a Brevo failure.

Supabase Auth email is separate from this outbox. Production custom SMTP is
enabled with the verified My Kustomers sender through Brevo. Signup and
password-recovery delivery, canonical callbacks, password update, old/new
password behavior, session establishment, and logout have controlled production
evidence.
See `docs/DOMAIN_EMAIL_INFRASTRUCTURE.md`.

## Release Process

1. Confirm the intended commit is pushed and the working tree is understood.
2. Open a pull request into `main` and require Quality, Tests, Build, Dependency
   Security, and E2E to pass.
3. Confirm the pull request is conflict-free before merge.
4. Merge only the reviewed commit. Vercel Git integration then deploys `main`.
5. Verify the Vercel deployment reports Ready and the stable alias points to it.
6. Run application-level smoke checks for Auth, protected pages, customer and
   booking workflows, public capability routes, Storage, metadata, PWA assets,
   responsive layouts, and runtime logs.
7. Record the deployed commit and deployment ID. Do not call a release verified
   merely because the platform build completed.

Vercel uses the repository's standard install and build behavior. The package
build command remains `next build --webpack`, and Node 22 or newer is required
by `package.json`.

`vercel.json` pins the Node function region to `lhr1`. This corrects the measured
pre-change path where requests entered through Dublin but executed in `iad1`
before calling the London Supabase project. Do not remove or change this region
without rechecking the active Supabase project region and production timings.
The first aligned deployment above reached `READY`/`PROMOTED` for Production,
and the stable domain returned `dub1::lhr1` before authenticated desktop,
mobile, standalone-window, and route-transition verification passed.

## Database Migrations

Vercel builds consume the already-reviewed Supabase schema. They do not run,
apply, repair, or reconcile database migrations. Migration application remains
a separate controlled operation under `docs/MIGRATIONS.md`; never add a
migration command to install, build, or deployment hooks.

## Rollback

For an application-only regression, use Vercel Deployments to promote the last
known-good Production deployment to the stable alias, then diagnose through a
normal corrective pull request. Confirm that the rollback commit expects the
currently deployed schema before promotion.

Environment or Supabase Auth changes must be rolled back separately through
their owning dashboards. A Vercel code rollback does not undo environment
variables, Auth allowlists, Storage changes, email-provider settings, or
database migrations. Database rollback requires a reviewed forward migration;
do not reverse immutable migration files or run an automatic destructive
rollback.

## Secret And Release Governance

- `.env` and its real-value variants remain Git-ignored.
- Vercel secrets are managed through Vercel environment configuration only.
- Every Production deployment must correspond to a known Git commit.
- Required CI must pass before merge and Production deployment.
- Production server secrets are not copied into Preview or Development by
  default.
- Supabase Auth redirects must be reviewed whenever a production domain changes.
- Deployment documentation must change with the deployment architecture.
- Build and deployment must never apply database migrations automatically.

The customer-communication detour requires the two ordered
`20260826032250_*` and `20260826032258_*` migrations before its application
commit is deployed. The enum addition must commit before functions reference the
new values. No Vercel environment change, provider credential change, Realtime
publication, service worker, cron, or new infrastructure is required. Production
smoke must use only new controlled events and must not replay historical outbox
rows.

## Initial Verification Evidence

The initial release passed local lint, typecheck, unit/integration/static tests,
the opt-in development Supabase runtime-security suite, full local Playwright,
production build, and moderate dependency audit. Production checks then passed
the canonical customer/booking/confirmation/amendment/add-on/feedback journey,
live customer and booking search, mobile account/logout, dashboard navigation,
business logo upload/replacement/public retrieval/removal, 390px and 1440px
layout checks, HTTPS health/manifest/icon checks, protected-route behavior, and
the public capability metadata/cache controls. The verification traffic
produced no Warning, Error, or Fatal Vercel runtime log entries.

## Business Logo 5 MiB Production Verification

PR #37 passed seven executable checks, with Runtime Security safely skipped by
the protected-target policy, and merged conflict-free as `dd0fe2c`. Vercel
reported the exact merge deployment `Ready` for Production with `main`,
`mykustomers.com`, and retained Vercel aliases attached. No environment, region,
domain, bucket, database, or infrastructure configuration changed.

Controlled canonical-domain smoke accepted an exact 5 MiB EXIF-oriented source
without a Vercel 413, reduced it to a 2,146,239-byte multipart request, and
persisted a 58,946-byte 384x512 metadata-free WebP. A 4.8 MiB mobile replacement
used 2,147,355 transport bytes and settled in 15.049 seconds under 180ms latency
and 1.2 Mbps upload throttling. A 5 MiB-plus-one-byte selection sent no request.
The `business-logos` bucket remained public-read, WebP-only, and limited to
204,800 bytes. Cleanup confirmed zero controlled Auth, profile, business, or
Storage leftovers.

## Sentry Production Configuration

Sentry requires `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT` in Vercel Production only. The DSNs and slugs
are non-secret configuration. `SENTRY_AUTH_TOKEN` is a secret build-only value
for release/source-map upload and must never have a `NEXT_PUBLIC_` prefix.
Preview and Development remain unconfigured unless separately reviewed.

The deployment is not observability-verified until its exact Git commit appears
as the Sentry release, source maps resolve controlled stack frames, browser and
server events show `production`, and privacy inspection finds no capability,
query, contact, header, cookie, body, user, or credential data. Rollback removes
or rotates Sentry configuration separately; promoting an older Vercel build does
not revoke a Sentry token.
