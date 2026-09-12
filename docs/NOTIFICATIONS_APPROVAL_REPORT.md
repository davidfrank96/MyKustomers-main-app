# PWA notifications and product positioning — approval report

> Historical approval checkpoint. The user subsequently approved both proposals
> with “yes procced”. See [the release report](NOTIFICATIONS_RELEASE_REPORT.md)
> for current implementation, application and deployment evidence.

Date: 2026-09-12. Branch: `feat/pwa-notifications`.

**PWA NOTIFICATIONS + PRODUCT POSITIONING — MIGRATION APPROVAL REQUIRED**

The positioning work is implemented locally. The notification feature is at the
explicit migration gate in the supplied request, sections 16/103/117. Neither SQL
file has been applied, even in a rollback transaction. No push UI/worker is
implemented or activated; no database, VAPID, scheduler, customer email, dependency,
PR, merge or Production deployment change was made.

## Exact approval artifacts

| File | SHA-256 | When it may run |
| --- | --- | --- |
| [Foundation SQL](../supabase/migrations/20260912001130_pwa_notifications_foundation.sql) | `3c3ab4a41cd63b34f50d2b7bca1846b92199f17532e5831c318df016ad8a9482` | After explicit schema approval, drift review and isolated database verification |
| [Scheduler activation SQL](../supabase/migrations/20260912002523_pwa_notification_scheduler_activation.sql) | `e9e01079286cfda24a165c9bebb24d2faf6a507642a826b31f67d09fd291a23f` | Separately approved; only after the worker is deployed and its dedicated secrets are configured |

The foundation adds three public RLS tables (notifications, preferences, device
subscriptions), two private tables (delivery state and booking-lifetime overdue
receipts), one global due-booking index, and narrow RPC/trigger functions.
Five event types are proposed: the required three plus confirmed amendments and
add-ons, with their justification, recipients, anchors and dedupe keys in
[NOTIFICATIONS.md](NOTIFICATIONS.md). History is 90 days; delivery evidence is
seven days; inactive devices expire after 180 days. Both active roles receive
operational events, subject to current membership/account checks.

The separately proposed scheduler enables available pg_cron 1.6.4 and pg_net
0.20.4 on existing Supabase, uses existing Vault for a dedicated worker credential,
and makes one request/minute to a fixed authenticated Vercel endpoint (up to 1,440
requests/day). It does not add a provider or upgrade the verified Vercel Hobby
plan. It still adds database/function usage requiring budget review. The two SQL
files must **not** be batch-applied. Complete RLS/grants, security model, ordering,
rollback strategy and post-approval test matrix are in [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Requested A–BS report

| Item | Evidence/status |
| --- | --- |
| A. Starting State | Clean main, fetch completed; HEAD/origin/main/Production `d9261d481fc5490635c8666480897e4eb39556ee`. One worktree; historical remote branches preserved. |
| B. Existing PWA Architecture | Static standalone manifest, versioned icons, native browser install facilities, bounded resume reconciliation. |
| C. Existing Service Worker | ABSENT; no private cache or registration. |
| D. Existing Push Support | ABSENT. |
| E. Notification Data Model Existing State | ABSENT in both repository and configured live catalog. Existing email outbox remains independent. |
| F. Migration Required | YES. Two complete SQL files linked above; neither applied. |
| G. Final Notification Architecture | Proposed durable per-user inbox, optional Web Push, server event triggers, bounded delivery worker. |
| H. Push Subscription Architecture | Proposed account-scoped multiple devices, endpoint uniqueness, 20-device quota, generation-safe invalidation and restricted keys. |
| I. VAPID Architecture | Proposed one standard key pair, private key server-only, existing operational hello alias as contact. No key generated. |
| J. Permission UX | Documented; UI pending approval. Explainer and direct Enable action only. |
| K. iOS Install/Permission UX | Documented Home Screen prerequisite, actual feature detection, contextual install help; pending implementation. |
| L. Android Permission UX | Documented browser/PWA support without forced installation; pending implementation. |
| M. Notification Preferences | Three proposed push categories; amendment/add-on confirmations share confirmations. In-app events remain durable. |
| N. In-App Notification Center | Proposed compact header bell/list, pagination, business context and empty state; not implemented. |
| O. Unread Badge | Proposed `9+` visual cap; not implemented. |
| P. App Badge | Proposed feature-detected update/clear on read/open/resume; not implemented or verified. |
| Q. Customer Confirmed Notification | Exact proposed AFTER INSERT trigger on `booking_confirmations`; runtime pending. |
| R. Feedback Received Notification | Exact proposed AFTER INSERT trigger on `feedback`; no feedback content stored in notification. Runtime pending. |
| S. Overdue Notification | Exact Dashboard/Bookings timestamp/status predicate, batch locking, persistent receipt, existing-backlog suppression; runtime pending. |
| T. Additional Notification Types Approved | NONE activated. AMENDMENT_RESPONDED and ADD_ON_RESPONDED are explicitly proposed for approval based on actual customer confirmation transitions. |
| U. Dedupe Strategy | Unique user/type/source UUID; unique notification/device; one overdue receipt per booking lifetime. Static contracts pass; runtime pending. |
| V. Multi-Device Result | Schema supports it; delivery not verified. |
| W. Multi-Business Result | Business/booking FK, account-scoped subscription, intended authenticated resolver; application behavior pending. |
| X. Revoked-Membership Result | Proposed RLS, emission/claim checks and immediate deletion trigger; live denial pending. |
| Y. Deep-Link Result | Proposed notification-ID resolver selects real booking/business and existing anchors. Not implemented. |
| Z. Logged-Out Deep-Link Result | Existing safe-next Auth path audited; notification resolver integration pending. |
| AA. Push Privacy Result | No payload persistence/customer PII columns; generic payload contract and sender/Sentry rules documented. Real worker pending. |
| AB. Service Worker Result | No worker added at gate; planned push-only worker cannot cache or intercept fetch. |
| AC. Invalid Subscription Cleanup | Proposed 404/410 generation-scoped revocation and bounded retention; runtime pending. |
| AD. Push Failure Result | No network in domain transaction; bounded response-based retries and terminal ambiguous sends proposed. Provider outage test pending. |
| AE. Real Android Result | NOT VERIFIED; no physical-device test. |
| AF. Real iOS Result | NOT VERIFIED; no physical Home Screen push test. |
| AG. PWA Result | Manifest identity/icons/display unchanged; public branding checks pass. New notification lifecycle untested. |
| AH. Performance Result | Positioning adds no dependency or request, one short paragraph. New worker performance/query plans pending; due-scan index justified by live catalog. |
| AI. Existing Positioning Findings | Restrictive homepage trust items, SEO title, manifest and email footer; product guidance matched the same restriction. |
| AJ. Small-Business String Count | 17 baseline matching lines across sources/docs/tests/one historical preview; six shipped-source lines fixed. Zero restrictive shipped-source matches remain; preserved history classified. |
| AK. Final Master Positioning | Built for service businesses — from independent operators to growing teams. |
| AL. Homepage Copy Result | Canonical audience, shorter workflow paragraph, Nigeria-and-beyond hero statement, broader trust items and audience heading. |
| AM. SEO Metadata Result | Title targets Service Businesses. Shared description/OG/JSON-LD already broad; schema types unchanged. |
| AN. PWA Manifest Result | Description broadened only; identity, start URL, display, names and icons preserved. |
| AO. Nigeria Positioning Result | Retained once as explicit hero audience strength, with “and beyond”; repeated audience-heading geography removed. |
| AP. Enterprise-Claim Audit | No unsupported enterprise claim added. |
| AQ. Database Changes | ZERO applied. Catalog-only read transactions confirmed no new tables and no cron/net installation. |
| AR. Environment Changes | No application environment value or push secret configured. |
| AS. Dependencies Added | NONE. Proposed web-push 3.6.7 isolated audit: zero vulnerabilities. Release metadata dated 2024-01-16; no claim of recent release. Temporary pglast parser used outside project. |
| AT. Files Changed | Listed by category below; no unrelated changes or existing migration rewrites. |
| AU. Tests Added | Eight static migration/security cases; two positioning cases. Existing homepage/SEO browser expectations updated; hero captures wait for rendered copy. |
| AV. Documentation Updated | README, Master Plan, Product Spec, Phases, Data Model, Decisions, Migrations, architecture, security, Testing, Changelog, PWA Reliability, Notifications, Product Positioning and this report. |
| AW. Responsive Matrix | Homepage checked at 320/360/375/390/430/768/1024/1440 plus 414/1280/1600; no overflow. Notification UI matrix pending. |
| AX. Accessibility | Existing homepage landmark/link/heading checks pass; new copy is semantic paragraphs. Notification bell/toggles/focus/screen-reader behavior pending. |
| AY. Alignment/Polish Pass | Final 320px page and 390/1440 hero visuals inspected; copy wraps and controls remain usable. Notification alignment pending. |
| AZ. Lint | Full repository lint passed; final changed-code lint passed. |
| BA. Typecheck | Passed; final build also validates TypeScript. |
| BB. Unit/Integration | Full run: 904 passed, 24 skipped. After the final scheduler contract/SQL refinements: 13 focused tests passed (including governance). |
| BC. Runtime Security | 21 tests skipped through the protected-target guard. Not live security evidence. |
| BD. E2E | Full public-safe run: 24 passed, 62 skipped, 2 failed on obsolete SEO audience assertions. Assertions fixed; final focused SEO run: 9 passed, 1 skipped, including both failed cases. No unresolved browser failure. |
| BE. Build | Final Production build passed with database credentials withheld; final typecheck also passed. |
| BF. Dependency Audit | Repository npm audit at moderate threshold: zero vulnerabilities. Isolated proposed-library audit also zero. |
| BG. Diff Check | Passed. |
| BH. PR Number | Not created at migration gate. |
| BI. CI Result | No remote CI run for this branch. |
| BJ. Preview Result | No Vercel Preview deployed at migration gate. Local public browser verification only. |
| BK. Merge SHA | No merge. |
| BL. Production Deployment | Existing deployment `dpl_nRFjLqPA3fL2U6s1Q39AJKE8Sx8Z` READY on starting SHA; unchanged by this task. |
| BM. Production Android Push Smoke | Not run. |
| BN. Production iOS Push Smoke | Not run. |
| BO. Sentry Result | No push telemetry implemented or sent. Privacy contract documented; no new Production Sentry event/log claim. |
| BP. Cleanup | No database fixtures/accounts/customer emails created. Test server stopped; generated declaration/artifact noise excluded from change. |
| BQ. Defects Found | Fixed obsolete copy assertions and screenshot loading-state race. Schema review corrected the real add-on enum and pending-onboarding sentinel before approval. |
| BR. Remaining Limitations | All notification runtime/UI/device tests, live SQL/RLS/concurrency verification, worker/secret/scheduler activation, PR/CI/Preview/Production remain pending. |
| BS. Final Status | PWA NOTIFICATIONS + PRODUCT POSITIONING — MIGRATION APPROVAL REQUIRED |

## Verification limits and files

Offline `pglast` parsed 69 foundation statements and 13 scheduler statements,
all SQL-language bodies and both DO blocks. Its PL/pgSQL parser accepted nine
of ten PL/pgSQL functions; it cannot resolve the private-schema composite row
type in `finish_notification_push`. This is a parser limitation, **not** proof
that the function compiles against PostgreSQL. No migration execution occurred.
Database compile, grants, RLS, trigger atomicity, concurrency, retry outcomes and
provider independence must be exercised on an approved isolated target next.

Product source changes: `app/page.tsx`, `lib/seo/site.ts`,
`lib/email/templates/shared.ts`, `public/manifest.webmanifest`, `package.json`.
SQL: the two complete files above. Tests: new
`tests/security/pwa-notifications-migration.test.ts` and
`tests/unit/product-positioning.test.ts`; modified
`tests/e2e/public-homepage.spec.ts` and `tests/e2e/seo-foundation.spec.ts`.
Documentation is listed in AV above. Existing historical generated email previews
and historical research/phase wording were preserved and classified, not served
as current marketing copy.

The next approval is for the exact foundation SQL and proposed scheduler design/
activation SQL. Approval must not be interpreted as proof of verification:
implementation, isolated tests and the prescribed release gates still follow.
