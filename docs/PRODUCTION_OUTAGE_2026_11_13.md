# Production incident — 13 November 2026

STATUS: PRODUCTION SERVICE RECOVERED — APPLICATION RELEASE VERIFIED

## Observed incident

Production release `22f07c70d9c72e0f585317e90e7a13e3a7d42533` served the public
login page and `/api/health`, but authenticated business membership reads failed.
The health route is application liveness, not database readiness.

Sentry's initial unresolved 14-day list contained five groups:

| Issue | Observed symptom | Diagnosis |
| --- | --- | --- |
| JAVASCRIPT-NEXTJS-2 / 144177768 | BusinessMembershipLookupError on login | Production trace contains four HTTP 503 requests |
| JAVASCRIPT-NEXTJS-A / 160684747 | Server Component render failure on login | Same trace as the membership exception; secondary browser report |
| JAVASCRIPT-NEXTJS-8 / 157744908 | WhatsApp worker unavailable | Database logs show claim_whatsapp_event returning HTTP 503 |
| JAVASCRIPT-NEXTJS-5 / 146629672 | Notification worker unavailable | Database logs show process_overdue_notifications returning HTTP 503 |
| JAVASCRIPT-NEXTJS-9 / 160629784 | Rate-limit storage unavailable | Production consume/lookup_source event has three HTTP 503 breadcrumbs |

Read-only REST probes returned `PGRST002`. Direct PostgreSQL and Auth settings
remained available. Expected RPC grants and membership SELECT permissions were
present. PostgreSQL had spare connections; no `pgrst.*` role overrides existed.
Exactly one notification cron job was active. Supabase marked the project
Unhealthy. PostgREST logs additionally reported `PGRST003`, timing out acquiring
its own pool connection even to read the PostgreSQL version. This establishes
the service/pool failure, not the original trigger of that failure.

One documented schema-cache NOTIFY did not restore REST service. The owner
approved a full restart of the existing Supabase project. The first successful
REST probe was at 01:33:55 UTC; the dashboard then reported Healthy, 4% CPU,
55% RAM and 5/60 connections. Subsequent membership, businesses, Auth settings
and application-health checks remained HTTP 200. The restart restored service;
the initial trigger of the internal pool failure remains unproven. No schema, permission, row, compute size,
subscription or scheduler change is part of this repair.

## Application changes

- A verified session with unavailable membership authority gets a retry screen
  on login. No workspace is rendered, zero membership is not inferred, and the
  session is retained. A normal GET retry rechecks current membership.
- Successful password/session creation and OAuth exchange can reach that
  recovery screen without replaying the authentication operation.
- Worker, limiter and login diagnostics retain only a reviewed finite set of
  infrastructure error codes. Raw database/provider messages, causes, details,
  hints, identifiers and parameters remain excluded. No delivery retry policy
  or rate-limit fail-open/fail-closed policy changes.
- Sentry source-map frame schemes and relative dot segments are preserved;
  query strings and capability paths remain redacted. Previously `app:///...`
  became `null/...`, preventing correct frame matching.
- Next.js, Sentry, Vitest and Zod are updated for current advisories. Zod 4's
  error customization replaces removed Zod 3 options. Narrow build-tool
  overrides pin patched glob 14.0.2 and minimatch 11.0.1 for their affected
  parent packages; the APIs consumed by those parents are retained. No audit
  exception is extended or used, and no CI check is disabled.

## Verification and release boundary

Local checks: clean npm ci, typecheck, lint (zero errors; existing warnings),
production build, 1,224 passing tests with 24 protected/environment-gated skips,
and all 24 audit-policy tests. Both production and full dependency audits are
clean without an exception. Focused follow-up includes signed-in signup recovery.
Production authenticated acceptance passed: a fresh `/login` navigation with the
existing account session redirected to `/dashboard` and rendered the Frankenstein
workspace. This proves returning-session membership routing; it is not a claim
of a new password/OAuth exchange in the production browser.

Read-only successful-statement counters between 01:43:44 and 01:46:29 UTC rose
by three each for `process_overdue_notifications`, `claim_notification_push` and
`claim_whatsapp_event`, confirming automatic scheduled database work resumed.
No claim/send RPC was manually invoked. PostgREST logs show the 10-connection
pool initialized and the schema cache loaded at 01:34:12 UTC. Sentry inspection
covered all five unresolved production groups in its available 30-day window;
worker and rate-limit event breadcrumbs also contain the pre-recovery HTTP 503s.

The application review was [PR #98](https://github.com/davidfrank96/MyKustomers-main-app/pull/98).
Implementation commit `85bf841a5aed194b050a2453650314a039a52cce` passed all seven
enabled jobs in [CI run 43347100458](https://github.com/davidfrank96/MyKustomers-main-app/actions/runs/43347100458),
including E2E, notification contracts and dependency security. Its test job
reported 1,225 passing tests and 24 guarded skips. Current-head checks remain
the authoritative merge gate; local evidence is not a substitute for them. Vercel preview success is not a production
application release. The existing guarded Runtime Security job remains skipped.
A skipped runtime security suite is not a security pass.

The owner manually merged PR #98 at 01:57:06 UTC. Vercel marks merge commit
`f933022aceb9761c2a62d21458fe4967fd665ce1` Ready in Production, with
`mykustomers.com` assigned, at 02:00:25 UTC (3m 15s build).
Deployment: [2UAt4hiri](https://vercel.com/david-frank-s-projects/my-kustomers-main-app/2UAt4hiri4EPd4jtfqXUw2abvj3R).
Post-deployment `/api/health` and public `/login` probes returned HTTP 200.
A fresh production `/login` browser navigation again redirected the existing
session to `/dashboard` and rendered the Frankenstein workspace on this release.
The initial deployment runtime-log view showed zero warnings/errors/fatal events,
with scheduled notification worker completion entries at 02:01 and 02:02 UTC.
This is a short observation window, not a guarantee against future incidents.
The assistant did not merge either application or documentation changes.
No Sentry issue is marked resolved merely because a patch exists or a short
observation window is quiet. No controlled customer message is sent by this task.
