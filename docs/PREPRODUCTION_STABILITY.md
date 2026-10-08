# Pre-production stabilization — 8 October 2026

STATUS: IMPLEMENTED — PRODUCTION RELEASE VERIFICATION PENDING

This is a bounded stabilization pass, not a commercial-launch approval, load test
or exhaustive security assessment. The user reserves the merge. Current-production,
local fixture, live rollback and pending release evidence are distinguished below.
No real messages were sent by the operational audit; no infrastructure was resized.

## Evidence and limits (requested A–BR report)

| ID | Item | Result |
| --- | --- | --- |
| A | Starting main SHA | `5bbd4be702dfeaded606a81a7b0af7640c1e304b` (PR #95). |
| B | Starting Production SHA | The same SHA; Vercel current/READY deployment `dpl_AXd5Ta6sYBjnT1pjFzTE6FHBZtJH`, canonical `mykustomers.com` and stable Vercel alias. |
| C | Sentry issue evidence | Issue `152107717` / `JAVASCRIPT-NEXTJS-6`; first 2026-10-07 13:10:22.849 UTC, last 13:10:36 UTC; route `/bookings/:bookingId`; privacy-redacted URL on the stable Vercel alias. Old client release `84971b283a59851ef243b37fbfd203da74a37982`. Browser identity is unavailable after privacy filtering. |
| D | Sentry occurrence count | 3 events. Reported user count 0 reflects privacy filtering and does not prove zero people affected. |
| E | Server Action root cause | The client submitted an action the responding server did not recognise. Version skew is strongly supported by the old client release and deployment timing; the original POST lacks the serving deployment ID, so exact request-to-server correlation is not proven. |
| F | Deployment/version-skew evidence | PR #94 deployment `dpl_ZCFVxL7eac6Zby4RpfaUkhxkDux4`, SHA `4485b2f322febb8ada8cea6d685e8ba10b627cfd`, became READY at 13:09:24.311 UTC, about 58 seconds before the first error. Old-release page activity began 13:08:51; three action POSTs returned 404. PR #95 became READY at 13:51:32.271 UTC, after all three events. Original hard-refresh outcome was not recorded. |
| G | Vercel Skew Protection | Hobby plan. Advanced settings offers Skew Protection as a Pro upgrade; not enabled, no active duration. No plan change. Supported deployment identification and bounded fallback are used. |
| H | Server Action fix | Prefer `NEXT_DEPLOYMENT_ID`, otherwise `VERCEL_DEPLOYMENT_ID` without its reserved `dpl_` prefix. Global boundary retains Sentry capture and flushes for up to 1.5 seconds before one same-URL reload only for the observed named/42-hex-ID error signature. A sessionStorage guard stores only `attempted`; blocked storage leaves the normal error UI. No encryption key or mutation replay. |
| I | Stale-client recovery result | PASS: two separate immutable local production builds with different actual action IDs behind a switching proxy. A→B mismatch reloaded once, preserved query URL, did not replay POST; new B action worked; B→A mismatch showed fallback without another reload. Synthetic browser fixtures also pass Chromium/WebKit. These are not two Vercel deployments or a real user session. |
| J | Localhost login reproduction | Existing port 3000 ran a stale optimized fixture build via `npm start`; user reported login failure. Its compiled backend used loopback test fixture endpoints, despite the source environment targeting the intended Supabase project. |
| K | Localhost Auth root cause | Local process/build drift, not a production Auth defect: stale Next 16.3.4 fixture output instead of current 16.3.8 development server. |
| L | Localhost env correction | No environment values changed. Public Auth URL/key and server key were defined and targeted the correct My Kustomers backend; APP_URL was localhost:3000. Only the stale process and rebuildable `.next` were replaced; dependencies installed from the existing lockfile; `npm run dev` restarted. |
| M | Localhost login final result | PASS: user entered credentials privately, reached Frankenstein; logout and exactly one intentionally invalid password returned the safe credentials error; user signed in again and reload retained `/dashboard` and the correct business. |
| N | Terms implementation | Shared server-rendered sixteen-section content, canonical public `/terms`, reusable Radix dialog with bounded scroll, footer/auth/Settings links, existing business-profile legal row and sitemap entry. No clickwrap, database read, acceptance logging or new dependency. |
| O | `/terms` result | PASS locally: HTTP 200, canonical URL and sixteen headings. Current production baseline returns 404 as expected before this PR is merged. Release verification remains pending. |
| P | Terms modal result | PASS Chromium/WebKit at ten exact sizes: open, end-scroll, contained geometry, keyboard focus trap, Escape, restored trigger and full-page link. 320px and 1440px screenshots visually reviewed. |
| Q | Legal-review items outstanding | Legal entity/address/company details, governing law/jurisdiction, official platform contact, solicitor review and release date confirmation. See LEGAL_REVIEW.md. |
| R | Privacy Policy | PRIVACY POLICY — PRE-LAUNCH FOLLOW-UP. No invented link or public placeholders. |
| S | READY reschedule source | Already implemented by PR #94 and present on current production SHA. No duplicate lifecycle/Safari implementation added. |
| T | READY Production migration | Previously absent by exact function-body comparison. Now APPLIED and verified against the existing reviewed migration. This older project has no `supabase_migrations.schema_migrations` table; catalog comparisons are the evidence, not a fabricated ledger. |
| U | Migration action | EXISTING MIGRATION USED: `20260924210343_reschedule_through_ready.sql`, SHA-256 `35fb8664b89906d00cfccf0d735e6972ae5b55ba9ec35cf85fd562c87bd92ed7`. Applied 2026-10-07 approximately 23:44 UTC (8 October Dublin) after source drift comparison, full-schema disposable tests, rollback preflight and transactional owner/ACL/security checks. |
| V | READY Production result | PASS rollback-only controlled transaction in the approved pilot: Email, WhatsApp and Both retained READY/ready_at, future date, one change/audit and one intended event per channel; duplicate request rejected; delivery blocked before reconfirmation; reconfirmation retained READY. All synthetic rows/outbox intents rolled back, no sends or fixtures persisted. |
| W | Safari validation | Existing Chromium/WebKit form-stability suite passes with all 70 WhatsApp UI cases. Physical iOS/Safari keyboards are not verified. |
| X | Local Git dirty-file inventory | Primary source tree initially clean on preserved `booking-currency-money-pwa`; observed development-generated `next-env.d.ts` was restored to its exact committed content. Local environment/output artifacts remain ignored; no blanket reset or source deletion. |
| Y | Preserved local work | All ten pre-existing worktrees and branches retained; stabilization uses an eleventh separate worktree. PR #86 and its branch remain untouched. |
| Z | Stash/safety branch | None necessary: no unique dirty source to stash. Existing branches/worktrees preserved in place. |
| AA | Primary VS Code repo | PRIMARY VS CODE WORKTREE — CLEAN. `main` equals `origin/main` at 5bbd4be; `git status --short` empty after restoring only the known generated type-reference file. Local dev server stays available. |
| AB | Public-route audit | Production `/`, `/login`, `/signup`, `/forgot-password` return 200; `/terms` awaits release. Auth HTML is private/no-store. Local public/Terms browser tests cover the requested dimensions. |
| AC | Auth audit | Local valid/invalid/logout/returning login passed. Supabase Site URL is canonical production; existing localhost:3000 and 127.0.0.1:3000 redirects are present. No redirect, cookie or production Auth policy changed. Signup requiring a controlled inbox remains gated. |
| AD | Vendor workflow audit | Read-only authenticated localhost current-main pages against the intended backend: dashboard, bookings, new booking, customers, insights, business, settings, notifications; 80 size checks passed. Existing booking and customer detail pages also loaded without horizontal overflow, read-only. Full mutating cloud journeys are delegated to existing CI with synthetic fixtures, not claimed from these read-only checks. |
| AE | Customer capability audit | Confirmation/amendment/add-on/feedback regressions are covered by existing unit, browser and isolated full-schema tests. Live rollback READY smoke exercises actual confirmation capabilities without releasing messages. No arbitrary real customer capability was consumed. |
| AF | Admin audit | All eight live Admin route groups returned 200 and expected headings; 80 size checks showed no horizontal overflow. Live Admin logout returned the signed-out login route; subsequent protected-route denial checked. No privilege or membership edits. |
| AG | Email audit | 100 SENT, one old PENDING and one old SENDING. Both stale records use synthetic domains (August/September); they were not replayed. This is a triage follow-up, not a claim of a fully empty queue or provider delivery. No messages sent by this audit. |
| AH | WhatsApp audit | Gateway HTTPS health 200, database healthy, session connected. Admin channel Restricted (test account), process restart count 0; reconnect attempts 37 unchanged across two samples. Two historical ACCEPTED events, zero pending/processing/unknown. ACCEPTED is not DELIVERED. Pilot entitlement remains exactly one business; environment and database pause gates remain intact and unchanged. |
| AI | Scheduler | ACTIVE, `myk-notifications`, every minute; 1440/1440 executions succeeded in the inspected 24-hour window. |
| AJ | PWA audit | Production manifest 200, standalone and expected scope/start URL. SW response 200/no-store, exact current source SHA-256 `8af4f75a23dc0d76cc974d48fefee9f9988160bd8ecfdd255cdaf3f03edb99c1`, no fetch handler/private HTML cache. Notification deep-link/worker-resume fixtures pass. Physical installed iOS/Android delivery remains unverified. |
| AK | Supabase security advisors | 0 errors, 57 warnings, 15 infos. Warnings: 53 authenticated SECURITY DEFINER entry points, one anon event-trigger function, two mutable search paths on invoker triggers, leaked-password protection disabled. All public tables RLS-enabled; reviewed public no-policy tables have no anon/auth SELECT. These findings require triage, not blanket function revocation or a claim of a penetration-test pass. |
| AL | Supabase performance advisors | 0 errors/warnings, 28 infos: 23 unindexed foreign keys and 5 unused indexes. No speculative index changes. |
| AM | Vercel runtime logs | Bounded pre-release baseline: 23:24–23:54 UTC on 7 October showed warning/error/fatal counts 0. Overview six-hour panel showed 905 CDN requests, 455 function invocations and 0% error rate. Not a post-release or full-history guarantee. |
| AN | Sentry baseline | Authenticated production last-24-hour query returned only the original three-event unresolved stale-action issue. It was not marked resolved. A meaningful post-release observation window remains required. |
| AO | Dependency security | Production audit: 0 vulnerabilities. Full audit: five high package entries from one development-only advisory. No compatible braces patch was available (registry latest 3.0.3 at inspection); lockfile unchanged. |
| AP | Temporary exception | Existing exact `GHSA-vfj7-8cjw-p6xm` development ESLint-chain exception retained unchanged; expires 2026-10-21 00:00 UTC. Policy and its 24 regression tests pass. Raw full npm audit remains nonzero; this is not a clean full audit. |
| AQ | Responsive matrix | 320×568, 360×800, 375×812, 390×844, 414×896, 430×932, 768×1024, 1024×768, 1280×800, 1440×900. 50 public + 80 vendor + 80 live Admin checks; public/auth/Terms and existing browser suites. Physical keyboards and every possible private data state are outside this evidence. |
| AR | Efficiency findings | Auth verification/context use request-scoped React cache; customer detail uses two parallel limit(1) existence reads; lists paginated; WhatsApp claims one event/invocation; push worker max four batches of two/35 seconds, maintenance limit 1000. Terms text stays server-rendered; no new polling/listeners/DB fetches. Public HTTP samples 217–360ms for successful routes are single observations, not SLOs. No measured regression warranted optimization. |
| AS | Database changes | Only the already-reviewed READY migration: five function replacements; sixth wrapper compared unchanged. Owners, ACLs, security-definer flags and search paths preserved. No table/RLS/grant/ledger/scheduler changes. |
| AT | Environment changes | None to production/local secrets or platform settings. Build configuration reads existing deployment-ID variables. Local process/cache repaired. |
| AU | Dependencies changed | None; installation follows the existing package-lock. |
| AV | Files changed | Application: public/auth/settings/business legal links, Terms server content/dialog/page, sitemap, global error helper and Next configuration. Tests: recovery/Terms/SEO/profile expectations/config. Documentation: this report, legal review and affected setup/product/migration/security/testing/release guides. Exact list is the PR diff. |
| AW | Tests added/updated | Three helper unit cases and three actual-config deployment-ID cases; real-boundary browser recovery in Chromium/WebKit; ten-width Terms/accessibility test in E2E and Profile job; SEO sitemap and profile navigation updated for the real new destination. No skips or security assertions weakened. |
| AX | Lint | PASS, zero errors. One pre-existing unused `writeFileSync` warning in WhatsApp fixture. |
| AY | Typecheck | PASS (`next typegen` + TypeScript). |
| AZ | Unit/integration | Initial full run: 1192 passed, 24 existing guarded skips, 205 files; three deployment-ID config regressions added after preview validation. Audit-policy tests separately: 24 passed. |
| BA | Runtime Security | SKIPPED: 21 guarded files/tests. Protected target remains required; never represented as PASS. |
| BB | Local E2E | 42 passed, 62 existing environment-gated skips in the isolated worktree without cloud test secrets. CI must run its configured authenticated journeys; local read-only acceptance is separate evidence. |
| BC | Profile/Social | Initial run: 49 passed, two stale expected link-count failures. Updated count for the implemented Terms link; both browser variants plus Terms passed the focused rerun (4 passed). Recovery cases passed both browsers. Exact full CI run is the release gate. |
| BD | Notification Contracts | 24 browser tests passed; existing isolated database contract job remains required in CI. |
| BE | WhatsApp UI | 70 passed Chromium/WebKit. Full-schema native database matrix also passed 24 lifecycle/channel combinations plus lifecycle/capability/tenant regressions. |
| BF | Build | PASS optimized Next 16.3.8 webpack build; `/terms` statically rendered. |
| BG | Dependency audit | Policy PASS; production clean; raw full audit fails for the narrowly accepted dev-only advisory (see AO/AP). Security check remains enabled. |
| BH | Diff check | `git diff --check` PASS before commit; final branch/CI whitespace gate required. |
| BI | PR | One focused stabilization PR from `fix/preproduction-stability-oct7` to `main`. Manual merge only; PR URL and current exact-head CI are supplied in the task handoff. |
| BJ | CI | Required executable checks must pass on the pushed head before handoff. Runtime Security remains its existing guarded skip. This committed report does not pre-claim an unobserved CI result; use the PR checks/current-head handoff. |
| BK | Merge SHA | NOT MERGED — explicitly reserved for the user. |
| BL | Production deployment | Existing baseline remains 5bbd4be. No production promotion for this branch; exact merged SHA/READY/current/canonical-alias proof must follow manual merge. |
| BM | Production smoke | Existing READY migration/rollback smoke and read-only baseline passed. New Terms/recovery and post-release Sentry/runtime observation remain pending manual release. |
| BN | P0 findings | No P0 observed in this bounded pass; not an exhaustive security or load certification. |
| BO | P1 findings | Pre-launch decisions: protected runtime-security evidence/dedicated E2E target, legal/contact/privacy review, and a dedicated sender before general WhatsApp rollout. No newly reproduced code-level P1 in the changed paths. |
| BP | P2/P3 findings | Stale synthetic email records; advisor triage/password protection; dev advisory expiry; historical gateway reconnect/swap monitoring; physical PWA/iOS acceptance. None was silently corrected or dismissed. |
| BQ | Pre-launch blockers | Manual merge and exact production verification; approved legal/contact/privacy inputs for commercial launch; protected runtime and physical-device evidence must be explicitly accepted or completed. Pilot-only WhatsApp must not be mistaken for a general rollout. |
| BR | Final readiness verdict | MY KUSTOMERS PRE-PRODUCTION STABILITY — BLOCKED. Implementation/local verification can be ready for PR review while final production readiness remains gated as above. |

## Gateway capacity and billing scope

Gateway Droplet `602854919`, `s-1vcpu-1gb`, remains $6/month, 1 vCPU, 1 GiB,
25 GiB disk; no attached volume, snapshot or backup. No resources created or
resized in this task. The DigitalOcean account also contains unrelated existing
paid resources, so an account-wide “exactly one Droplet” claim would be false.

Measured memory: 961 MiB total, 464 MiB used, 497 MiB available; swap 118/2047 MiB
used, no active swap-in/out in the short vmstat sample. Node RSS 111.6 MiB, heap
37.2/40.1 MiB; MySQL RSS 69.1 MiB. Load 0.00/0.00/0.00; sampled Node CPU 0%,
MySQL 0.9%. Process uptime about 7.7 days, system uptime 15 days, systemd restarts
0; no kernel OOM matches in the inspected seven days. Reconnect attempts 37, opens 38/disconnects 37 over that process lifetime;
unchanged between the two observations, not a claim of zero reconnects.

Capacity verdict: **$6 DROPLET — SUITABLE WITH RESOURCE CAUTION**. This is current
pilot headroom, not load-tested capacity. Retain swap/reconnect monitoring.

## Audit interpretation and release checklist

- Keep dependency security enabled and the exact exception expiry intact.
- Do not replay historical synthetic email entries merely to make counts zero.
- Advisor `rls_auto_enable` is an event-trigger function, not an ordinary callable
  business RPC. The two mutable-search-path functions are invoker triggers with
  simple NEW-row operations. The authenticated RPC warnings still need deliberate
  boundary review; mass revocation would break the app.
- The production database had no migration ledger before this task. Exact catalog
  function matching was checked before and after the reviewed transaction; no
  migration history was invented or rewritten.
- After manual merge, verify the exact SHA is READY/current at `mykustomers.com`,
  public `/terms`/all links, Auth/routing and the normal booking flows. Inspect
  Sentry and Vercel over a recorded meaningful window. Do not resolve the old issue
  solely because no event appears for five minutes.
- Final legal inputs are in [LEGAL_REVIEW](LEGAL_REVIEW.md). Physical Safari/PWA
  and protected runtime-security gaps remain explicit.

Local evidence (ignored, not committed): `output/playwright/preproduction/`
contains sanitized test logs, responsive counts and Terms screenshots. Schema-only
exports and pre-migration function snapshots are local, restricted-permission
operational artifacts, not application fixtures. Secrets/real recipient numbers
are not committed. The immutable-build reproduction used synthetic actions only.

References: [Next deploymentId](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId),
[Vercel Skew Protection](https://vercel.com/docs/skew-protection),
[Sentry issue](https://my-kustomers.sentry.io/issues/152107717/).


## Preview validation correction

The first preview rejected the full Git SHA with `INVALID_DEPLOYMENT_ID` (maximum
32 characters). The fallback now uses the unique Vercel deployment identifier
without the reserved `dpl_` prefix, preserving Next's own injected ID when present.
This also gives two redeployments of the same commit different identities, as
required by Vercel. Three actual-config regression tests cover precedence, valid
length/characters/uniqueness and local absence. Final preview/CI must be evaluated
on the corrected head; the earlier preview failure is not a production incident.
