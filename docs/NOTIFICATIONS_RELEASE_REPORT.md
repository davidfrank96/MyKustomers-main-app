# PWA notifications and product positioning — release report

Date: 2026-09-12. User approved the complete foundation and separate scheduler
proposals with “yes procced”. Approval hashes and historical starting-state
verification are preserved in [the approval report](NOTIFICATIONS_APPROVAL_REPORT.md).

Status: IMPLEMENTED — DEVICE VERIFICATION PENDING; deployed to Production.

## Requested A–BS report

| Item | Evidence/status |
| --- | --- |
| A. Starting State | Clean main, fetch completed; HEAD/origin/main/Production `d9261d481fc5490635c8666480897e4eb39556ee`. One worktree; historical remote branches preserved. |
| B. Existing PWA Architecture | Static standalone manifest, versioned icons, native browser install facilities, bounded resume reconciliation. |
| C. Existing Service Worker | ABSENT; no private cache or registration. |
| D. Existing Push Support | ABSENT. |
| E. Notification Data Model Existing State | ABSENT in both repository and configured live catalog. Existing email outbox remains independent. |
| F. Migration Required | YES. Both exact SQL proposals approved and applied transactionally. Foundation catalog and active minute scheduler verified. |
| G. Final Notification Architecture | Implemented durable per-user inbox, optional standard Web Push, authoritative event triggers, bounded server worker. |
| H. Push Subscription Architecture | Implemented account devices, 20-device quota, global endpoint ownership, generation-safe revocation and column-restricted keys. |
| I. VAPID Architecture | Standard VAPID pair configured in Production. Separate random worker credential stored in Vercel and, after explicit user approval, existing My Kustomers Vault. No private values in reports. |
| J. Permission UX | Explicit Enable action invokes permission before awaited I/O. Not now, denied, unsupported, failure and enabled states. Browser fixture journeys pass. |
| K. iOS Install/Permission UX | Home Screen guidance for iOS/iPadOS; feature detection plus standalone checks. Emulated WebKit passes; physical delivery unverified. |
| L. Android Permission UX | Supported Android browser/PWA paths do not require installation. Explicit permission flow tested with mocked native APIs. |
| M. Notification Preferences | Three implemented account-wide push flags. Confirmed amendments/add-ons share confirmations. Preferences do not remove in-app history. |
| N. In-App Notification Center | Header bell/dialog and /notifications page; bounded 25-row pagination, business/reference context, empty/error states, read marking. |
| O. Unread Badge | Implemented exact accessible count with visual 9+ cap, refreshed on open/resume/read/push events. |
| P. App Badge | Feature-detected set/clear in client/worker. Read/logout reconciliation implemented; physical OS behavior unverified. |
| Q. Customer Confirmed Notification | Applied AFTER INSERT booking_confirmations trigger; isolated PostgreSQL recipient/dedupe tests pass. |
| R. Feedback Received Notification | Applied AFTER INSERT feedback trigger; durable history survives push opt-out. No feedback content in payload. |
| S. Overdue Notification | Applied exact schedule/status predicate, locking and lifetime receipt. Existing backlog suppressed with 21 receipts; no historical notifications. |
| T. Additional Notification Types Approved | AMENDMENT_RESPONDED and ADD_ON_RESPONDED approved and applied only on real customer confirmation transitions. |
| U. Dedupe Strategy | User/type/source unique key, notification/device unique key, persistent overdue receipt; local PostgreSQL and concurrent-worker tests pass. |
| V. Multi-Device Result | Two-device fixture and two concurrent PostgreSQL workers receive independent leases. Physical multi-device handoff unverified. |
| W. Multi-Business Result | Composite booking/business FK plus current RLS. Browser/API resolver test selects the notification business, not current cookie. |
| X. Revoked-Membership Result | Applied immediate delete trigger; RLS excludes stale membership and disabled users. Isolated runtime tests pass. |
| Y. Deep-Link Result | Authenticated resolver checks notification/booking with RLS, selects business, marks read and uses real booking anchors. Unit/browser tests pass. |
| Z. Logged-Out Deep-Link Result | Safe login next points back to notification resolver. Fresh authentication then current authorization required. Tests pass. |
| AA. Push Privacy Result | Trusted generic copy, version/type/UUID/count only. Endpoint/key/payload sanitization and malicious worker input tests pass. |
| AB. Service Worker Result | One push-only /sw.js; no fetch handler, CacheStorage or private-response cache. No-store/CSP headers tested. |
| AC. Invalid Subscription Cleanup | 404/410 generation-scoped revocation, 30-day revoked/180-day inactive retention. Runtime SQL and transport tests pass. |
| AD. Push Failure Result | No provider work in domain transaction. Explicit 429/5xx bounded retries; timeout/crash unknown is terminal. SDK transport tests pass. |
| AE. Real Android Result | NOT VERIFIED; no physical-device test. |
| AF. Real iOS Result | NOT VERIFIED; no physical Home Screen push test. |
| AG. PWA Result | Manifest identity unchanged; registration only from vendor shell. Existing resume coordinator/file-picker logic retained. No physical installed-device proof. |
| AH. Performance Result | No startup-blocking notification fetch or browser SDK. On-demand list, bounded count reconciliation, partial due index, max eight sends per scheduled invocation. Three warm homepage samples: median headers 85 ms before, 76 ms after; HTML 89,771→91,434 bytes. This is a smoke comparison, not a statistical latency guarantee. Authenticated/PWA journeys pass; server SDK stays outside client bundles. The initial public-script overhead was removed by the PR #78 follow-up documented below. |
| AI. Existing Positioning Findings | Restrictive homepage trust items, SEO title, manifest and email footer; product guidance matched the same restriction. |
| AJ. Small-Business String Count | 17 baseline matching lines across sources/docs/tests/one historical preview; six shipped-source lines fixed. Zero restrictive shipped-source matches remain; preserved history classified. |
| AK. Final Master Positioning | Built for service businesses — from independent operators to growing teams. |
| AL. Homepage Copy Result | Canonical audience, shorter workflow paragraph, Nigeria-and-beyond hero statement, broader trust items and audience heading. |
| AM. SEO Metadata Result | Title targets Service Businesses. Shared description/OG/JSON-LD already broad; schema types unchanged. |
| AN. PWA Manifest Result | Description broadened only; identity, start URL, display, names and icons preserved. |
| AO. Nigeria Positioning Result | Retained once as explicit hero audience strength, with “and beyond”; repeated audience-heading geography removed. |
| AP. Enterprise-Claim Audit | No unsupported enterprise claim added. |
| AQ. Database Changes | Both approved migrations applied. Five RLS tables/six triggers, service-only delivery RPCs, pg_cron 1.6.4, pg_net 0.20.4. One ACTIVE minute job; private invoke access denied; net is excluded from the Data API. |
| AR. Environment Changes | Four notification variables in Production only; private key and worker secret sensitive. Vault contains the dedicated worker credential. Preview has no Production credentials. |
| AS. Dependencies Added | web-push 3.6.7 and dev-only @types/web-push 3.6.4. npm audit zero known vulnerabilities at install. |
| AT. Files Changed | Notification contracts/API/worker/UI/resolver/logout; push-only service worker and headers; typed DB contracts; SQL; positioning; unit/browser/database tests; CI and governance documentation. |
| AU. Tests Added | SQL runtime/concurrent worker runner, static SQL security, payload/transport/privacy/HTTP/resolver/logout units, credential-free Chromium/WebKit notification journeys. |
| AV. Documentation Updated | README, Master Plan, Product Spec, Phases, Data Model, Decisions, Migrations, architecture, security, Testing, Changelog, PWA Reliability, CI, Notifications, Product Positioning, approval and release reports. |
| AW. Responsive Matrix | Notification center/settings checked at 320/360/375/390/430/768/1024/1440 in Chromium and WebKit. No horizontal overflow; screenshots inspected at 320/390/1440. |
| AX. Accessibility | Labelled bell, accessible unread count, semantic items/time, labelled preferences, dialog Escape/focus restoration, live status/errors. Browser checks pass. |
| AY. Alignment/Polish Pass | Inspected compact header, long context, settings, denied/install states, dialog and mobile navigation. Checkbox updates immediately with rollback on failure. |
| AZ. Lint | Passed. |
| BA. Typecheck | Passed. |
| BB. Unit/Integration | Final CI: 945 passed, 24 skipped; 156 test files passed and 21 protected/optional suites skipped. |
| BC. Runtime Security | 21 tests skipped through the protected-target guard. Not live security evidence. |
| BD. E2E | Full release CI: 69 passed, 19 skipped. Notification fixture browser journeys: 12/12 in Chromium/WebKit; native PostgreSQL runtime and concurrent lease checks pass. |
| BE. Build | Passed; network access required for the existing Google font dependency. Typecheck then passed sequentially. |
| BF. Dependency Audit | Final npm audit: zero known vulnerabilities. |
| BG. Diff Check | Passed before release commit. |
| BH. PR Number | [PR #77](https://github.com/davidfrank96/MyKustomers-main-app/pull/77). |
| BI. CI Result | All required jobs plus Notification Contracts passed in [run 34666183030](https://github.com/davidfrank96/MyKustomers-main-app/actions/runs/34666183030). Runtime Security intentionally skipped by its existing guard. |
| BJ. Preview Result | READY `dpl_HgWdi3uop9DKh12Ez5j1nRyydbaR`, source `72cb0d16025bee531f4a1728f86f709ebafb7e16`. Public positioning, manifest, worker headers, private 401s and relative login redirect verified. |
| BK. Merge SHA | PR #77 merged as `12d97c8d2bbe37928311a288aa6e9063416c8eb3`. |
| BL. Production Deployment | READY `dpl_8kGuqrffhgQBuaXEUaDaFu9otEDP` at the PR #77 merge SHA; [mykustomers.com](https://mykustomers.com). Public routes, private boundaries, authenticated 202 receiver and scheduled completion verified. |
| BM. Production Android Push Smoke | Not run. |
| BN. Production iOS Push Smoke | Not run. |
| BO. Sentry Result | Privacy units pass; fixed failure messages and aggregate-only completion logs. Private VAPID/worker values absent from built browser artifacts. Production completion logs verified without notification data; no direct Sentry issue-console verification available. |
| BP. Cleanup | Existing E2E CI uses the configured Production-backed project despite the intended test-target documentation. Its controlled fixtures use development email. Two verified cancelled-run fixture users/businesses were removed; successful suites perform their own cleanup. No real customer email sent for push testing. One controlled Auth user used for API-boundary verification was removed. Native clusters stopped/removed. Scheduler remains ACTIVE. |
| BQ. Defects Found | Fixed Next internal-host same-origin rejection, asynchronous checkbox feedback, old unit/E2E no-worker assumptions, test Auth isolation, fixture projection/browser-interception differences, older psql output handling in the concurrency harness, Linux WebKit’s combined eight-viewport test budget, the scheduler/worker timeout mismatch (202 acknowledgement with retained background work), and unintended dashboard chunks in the public homepage (explicit vendor client entry plus server-only validation). |
| BR. Remaining Limitations | Physical Android/iOS lock-screen delivery and badging unverified; no real provider subscription on target at release. Existing E2E target isolation needs correction; protected cloud security suite remains skipped. HTTP 202/completion proves server processing, not phone delivery. Current dispatch bound is eight devices/minute. Supabase-owned net grants remain; client Data API isolation and private wakeup ACL were verified instead. |
| BS. Final Status | PWA NOTIFICATIONS + PRODUCT POSITIONING — IMPLEMENTED — DEVICE VERIFICATION PENDING |

## Verification boundary

The native PostgreSQL suite uses a disposable cluster with minimal domain-table
dependencies. It verifies real PostgreSQL RLS, grants, triggers, constraints and
leases, including concurrent sessions. The same complete foundation separately
compiled against the actual configured Supabase schema in a rollback transaction
before application. The isolated notification suites insert no Production fixtures. The existing E2E workflow was found to use the Production-backed project; controlled cancelled-run fixture leftovers were removed.

The browser suite runs real Next routes/components against loopback Auth/REST
fixtures. Native permission/subscription APIs are explicitly mocked in enable/
disable cases. These tests are UI integration evidence, not real Supabase Auth,
push provider acceptance, physical iOS Home Screen delivery or Android OS proof.

## Controlled device follow-up

Use Settings → Notifications → Enable notifications on a controlled vendor
account. On iPhone/iPad first use Safari → Share → Add to Home Screen, then open
the installed app. Confirm one controlled booking/feedback event, observe one
lock-screen notification, tap through to the correct business/booking, mark read,
and verify badge clearing. Repeat with two controlled devices and revoke one.
Do not send customer email solely for push testing. Record OS/browser versions,
permission/install state and actual outcomes; never substitute emulator results.

## Scheduler verification — 2026-09-12 UTC

Job `myk-notifications` is ACTIVE at one-minute cadence. The 02:11, 02:12 and
02:13 runs succeeded and each pg_net response was 202 with no timeout. Runtime
logs confirmed completion, including an overdue processing batch, with no worker
errors or HTTP 5xx in the inspected release window. Provider/device delivery is
unverified because no real push subscriptions were registered at release.

The deployment above identifies the verified initial application release.
[PR #78](https://github.com/davidfrank96/MyKustomers-main-app/pull/78) records this
evidence and corrects the public-page bundle regression found in the final audit.
It keeps authentication in the server layout, makes the interactive dashboard
shell an explicit client entry with minimal display props, and moves Zod request
validation into a server-only module. Scheduler activity is unchanged.

Decoded homepage JavaScript measured 914,228 bytes before the feature and
1,072,715 bytes in the initial release. The corrected local Production build is
909,160 bytes across 15 external scripts (versus 22 in the initial release).
These are decoded resource sizes, not compressed network transfer or device
startup measurements. Final deployed verification is recorded in PR #78.

The approved net REVOKE statements did **not** remove Supabase-owned PUBLIC
grants. Anon and controlled authenticated API probes rejected net/private access
with 406/PGRST106; API roles cannot log in to PostgreSQL; GraphQL is disabled;
no exposed definer wrapper references net/Vault; private wakeup execution is
denied. This follows [Supabase's documented boundary](https://supabase.com/docs/guides/database/extensions/pg_net#permissions),
with owner-level ACL hardening remaining unavailable to the tenant role.
