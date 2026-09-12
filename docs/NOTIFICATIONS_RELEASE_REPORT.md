# PWA notifications and product positioning — release report

Date: 2026-09-12. User approved the complete foundation and separate scheduler
proposals with “yes procced”. Approval hashes and historical starting-state
verification are preserved in [the approval report](NOTIFICATIONS_APPROVAL_REPORT.md).

Status: IMPLEMENTED — RELEASE AND DEVICE VERIFICATION PENDING.

## Requested A–BS report

| Item | Evidence/status |
| --- | --- |
| A. Starting State | Clean main, fetch completed; HEAD/origin/main/Production `d9261d481fc5490635c8666480897e4eb39556ee`. One worktree; historical remote branches preserved. |
| B. Existing PWA Architecture | Static standalone manifest, versioned icons, native browser install facilities, bounded resume reconciliation. |
| C. Existing Service Worker | ABSENT; no private cache or registration. |
| D. Existing Push Support | ABSENT. |
| E. Notification Data Model Existing State | ABSENT in both repository and configured live catalog. Existing email outbox remains independent. |
| F. Migration Required | YES. Both exact SQL proposals approved by the user; foundation applied transactionally and live catalog checked. Scheduler waits for deployed receiver. |
| G. Final Notification Architecture | Implemented durable per-user inbox, optional standard Web Push, authoritative event triggers, bounded server worker. |
| H. Push Subscription Architecture | Implemented account devices, 20-device quota, global endpoint ownership, generation-safe revocation and column-restricted keys. |
| I. VAPID Architecture | Generated standard VAPID pair; public browser key and private Production secret. Separate random worker credential. No private values in reports. |
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
| AH. Performance Result | No startup-blocking notification fetch or browser SDK. On-demand list, bounded count reconciliation, partial due index, max eight sends per scheduled invocation. Full production latency comparison remains a manual follow-up. |
| AI. Existing Positioning Findings | Restrictive homepage trust items, SEO title, manifest and email footer; product guidance matched the same restriction. |
| AJ. Small-Business String Count | 17 baseline matching lines across sources/docs/tests/one historical preview; six shipped-source lines fixed. Zero restrictive shipped-source matches remain; preserved history classified. |
| AK. Final Master Positioning | Built for service businesses — from independent operators to growing teams. |
| AL. Homepage Copy Result | Canonical audience, shorter workflow paragraph, Nigeria-and-beyond hero statement, broader trust items and audience heading. |
| AM. SEO Metadata Result | Title targets Service Businesses. Shared description/OG/JSON-LD already broad; schema types unchanged. |
| AN. PWA Manifest Result | Description broadened only; identity, start URL, display, names and icons preserved. |
| AO. Nigeria Positioning Result | Retained once as explicit hero audience strength, with “and beyond”; repeated audience-heading geography removed. |
| AP. Enterprise-Claim Audit | No unsupported enterprise claim added. |
| AQ. Database Changes | Foundation applied after approval, local PostgreSQL and actual-schema rollback compile. Five RLS tables/six triggers; live function/column grants verified. Scheduler not yet activated at this checkpoint. |
| AR. Environment Changes | Four notification variables configured in Production only. VAPID private key and worker secret sensitive; local copy gitignored. Preview gets no Production credentials. |
| AS. Dependencies Added | web-push 3.6.7 and dev-only @types/web-push 3.6.4. npm audit zero known vulnerabilities at install. |
| AT. Files Changed | Notification contracts/API/worker/UI/resolver/logout; push-only service worker and headers; typed DB contracts; SQL; positioning; unit/browser/database tests; CI and governance documentation. |
| AU. Tests Added | SQL runtime/concurrent worker runner, static SQL security, payload/transport/privacy/HTTP/resolver/logout units, credential-free Chromium/WebKit notification journeys. |
| AV. Documentation Updated | README, Master Plan, Product Spec, Phases, Data Model, Decisions, Migrations, architecture, security, Testing, Changelog, PWA Reliability, CI, Notifications, Product Positioning, approval and release reports. |
| AW. Responsive Matrix | Notification center/settings checked at 320/360/375/390/430/768/1024/1440 in Chromium and WebKit. No horizontal overflow; screenshots inspected at 320/390/1440. |
| AX. Accessibility | Labelled bell, accessible unread count, semantic items/time, labelled preferences, dialog Escape/focus restoration, live status/errors. Browser checks pass. |
| AY. Alignment/Polish Pass | Inspected compact header, long context, settings, denied/install states, dialog and mobile navigation. Checkbox updates immediately with rollback on failure. |
| AZ. Lint | Passed. |
| BA. Typecheck | Passed. |
| BB. Unit/Integration | Final full run: 942 passed, 24 skipped; 155 test files passed and 21 protected/optional suites skipped. |
| BC. Runtime Security | 21 tests skipped through the protected-target guard. Not live security evidence. |
| BD. E2E | 12/12 notification fixture browser journeys passed; the final enabled-device logout extension also passed in both browsers. Previous public positioning and SEO checks retained; final release checks recorded below. |
| BE. Build | Passed; network access required for the existing Google font dependency. Typecheck then passed sequentially. |
| BF. Dependency Audit | Final npm audit: zero known vulnerabilities. |
| BG. Diff Check | Passed before release commit. |
| BH. PR Number | Pending creation after local gates. |
| BI. CI Result | Pending PR checks, including added Notification Contracts job. |
| BJ. Preview Result | Pending deployment; intentionally no Production runtime credentials. |
| BK. Merge SHA | Not merged yet. |
| BL. Production Deployment | Starting deployment unchanged at this checkpoint. Release follows required CI. |
| BM. Production Android Push Smoke | Not run. |
| BN. Production iOS Push Smoke | Not run. |
| BO. Sentry Result | Privacy unit tests pass; worker captures fixed messages only. Private VAPID and worker values are absent from all 136 built browser artifacts. No Production log/issue scan yet. |
| BP. Cleanup | No cloud test users/businesses/customer emails created. Local SQL fixtures are rolled back or disposable clusters removed. Initial local cluster will be stopped after verification. |
| BQ. Defects Found | Fixed Next internal-host same-origin rejection, asynchronous checkbox feedback, old no-worker test assumption, test Auth isolation, and fixture projection/browser-interception differences. |
| BR. Remaining Limitations | Physical Android/iOS lock-screen delivery/badging unavailable. Protected cloud security suite remains skipped. PR/CI/Preview/Production and scheduler activation still pending at this checkpoint. |
| BS. Final Status | PWA NOTIFICATIONS + PRODUCT POSITIONING — RELEASE VERIFICATION PENDING |

## Verification boundary

The native PostgreSQL suite uses a disposable cluster with minimal domain-table
dependencies. It verifies real PostgreSQL RLS, grants, triggers, constraints and
leases, including concurrent sessions. The same complete foundation separately
compiled against the actual configured Supabase schema in a rollback transaction
before application. No test fixture data was inserted into Production.

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
