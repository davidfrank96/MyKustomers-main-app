# Golden stability pass — 2026-09-14

Status: IMPLEMENTED LOCALLY — MIGRATION APPROVAL REQUIRED. Not merged or deployed.
The PR and its live checks are the current release record; this report records local evidence.

The current Production scheduler was read directly: `myk-notifications`, ACTIVE,
`* * * * *`. No scheduler mutation has occurred. The retention correction cannot
be released as complete without the [locally tested database proposal](proposals/NOTIFICATION_RETENTION_APPROVAL.md).

## A. Starting repository and Production

Clean feature checkout `1e8eb18`; fetched main `20066c2f9be4cad28b17c5143742f234ec3371d3`
contains PR #81. New branch `chore/golden-stability-pass` starts at that main.
Vercel's current Production target is READY/PROMOTED deployment
`dpl_9DVCmeJYnoWbbXiohLwwCwn21J4Z` on the exact same SHA, assigned to
`mykustomers.com`. The connected Vercel/Supabase apps expose different accounts;
read-only evidence used the repository's configured CLI/database account.

## B. Bottom-nav reproduction

Chromium and emulated iPhone WebKit: Settings → bell → customer-confirmation
notification → real Booking Details anchor → scroll → Back → Settings. Ordinary
navigation also covers Home, Bookings, Booking Details, Customers, Customer
Details, My Profile, Notifications, New Booking, business editor and Settings.
Before-change checks at 390×844 and 1440×900 reproduced zero nav drift. After
checks cover all 17 exact viewports below and five scroll positions per mobile
route. The reported physical-phone intermittency is NOT REPRODUCED locally.

## C. Bottom-nav root cause

Not established. The fixed nav's ancestors introduce no transform, filter,
perspective, containment or `will-change` containing block. Header backdrop blur
is a sibling, not a nav ancestor. No route transition wrapper animates the shell.
No speculative navigation CSS change is justified by current evidence. Separately, Preferences navigation from the bell reproduced a retained dialog/body lock in both engines: the shared shell keeps NotificationBell mounted across client navigation.

## D. Bottom-nav fix

Shared shell/nav code is unchanged. Permanent geometry regressions are added;
they require the nav bottom to stay within 2 CSS pixels of the viewport through
scrolling. The absence of a reproduction is not proof the physical defect is fixed.

## E. Scroll locks

Closing the bell, following its document resolver and returning with Back pass
body `overflow`, `position`, and `pointer-events` cleanup checks. Radix owns the
lock lifecycle. Modal history now scrolls independently. Preferences now closes the dialog through Next Link onNavigate before the client transition, allowing Radix to release its own lock. Both engines reproduced the prior failure and pass the fix against the optimized build. No global body style reset or overflow suppression was introduced.

## F. Safe areas and clearance

Existing nav padding keeps `env(safe-area-inset-bottom)` inside its surface;
shared shell reserves `4.5rem + inset` below content. Existing top header and
modal `dvh`/safe-area bounds are preserved. Tests simulate changing viewport
heights/orientation; real browser chrome, physical keyboards and home-indicator
insets remain device evidence, not desktop emulation claims.

## G. Notification panel before

The bell's outer dialog was already viewport bounded, but its entire content
scrolled. The standalone notification page appended each batch to document
height. The new shared history region is independently scrollable, with a
viewport-aware cap and an accessible region name; toolbar controls stay above it.

## H. Notification query

List: four bounded Data API reads plus fresh Auth: 26 notification rows (25 +
sentinel), unread count, one batch of business names, one batch of references.
No N+1 lookup or customer/contact payload. The new server cutoff combines with
the existing cursor; unread counting stays independent of history expiry.

## I. Schema audit

Live `public.notifications.read_at` exists as `timestamptz`, nullable with a
created-time consistency constraint. Existing history/unread/booking indexes
and RLS were inspected. The retention index currently targets `created_at`.
Service role has neither SELECT nor DELETE on the inbox table.

## J. Read timestamp

Existing mark-read and mark-all routes set server time only where `read_at IS
NULL`. Reopening and mark-all preserve existing timestamps. Merely opening the
panel or displaying push does not mark history read. Existing authorization,
first-open resolver and selected-business checks stay in place.

## K. Retention rule

Implemented API filter: unread OR read at/after server time minus 72 elapsed
hours. Exactly 72h stays visible; older read history is omitted. No created_at
or updated_at approximation. Physical retention change is awaiting approval.

## L. Physical cleanup

Proposed replacement of the existing service-only maintenance function uses
`read_at < now() - interval '72 hours'` and ordered bounded deletion. A partial
`(read_at,id)` index avoids scanning old unread history. All private delivery,
device, revoked-authority cleanup and overdue dedupe receipts are preserved.
Local PostgreSQL tests pass; Production SQL has not been applied.

## M. Scheduler

ACTIVE, every minute, verified from the live catalog. No cadence or scheduler
configuration change. The application worker's maintenance stage is limited to
UTC minutes 0,15,30,45 after overdue generation and push processing, capped at
1,000 rows per existing category. Normal generation/delivery remain every minute.
This application change is not deployed while the SQL proposal is pending.

## N. Panel performance

A list response now updates the bell from its returned unread count. Opening or
closing the bell no longer causes a duplicate count-only request. The browser
regression observes zero count-only requests during repeated panel opens/closes
following initial badge load. Pagination remains 25 records per request.

## O. Notification deep links

Real application resolver and booking route pass with local Auth/REST fixtures:
notification-owned Business B replaces previously selected Business A. Back,
reload and cold resolver tests preserve one shell. Fixture tests are separate
from the actual SQL RLS/ACL test layer. Physical system-push delivery is unavailable.

## P. Done before

Ordinary tabs kept the same Done button indefinitely: close was attempted only
when `window.opener` existed, and there was no fallback transition.

## Q. Causes

The Done handler had no terminal-state update. A separate cold-load WebKit defect
was reproduced twice: the input event occurred before React attached its props
(997ms); the review click occurred after attachment (1088ms), when controlled
state was still empty. Evidence: local `before/notification-webkit/input-events.json`.

## R. Final Done behavior

The trusted click attempts close once, then renders “You're all set” if the tab
remains. The button disappears immediately, confirmed business/email guidance
remains, and no action/email call is made again. A synchronous guard handles
rapid clicks. A thrown close error follows the same fallback.

## S. Window close

Real script-opened windows close successfully in Chromium and WebKit. A denied
close is explicitly simulated to verify the fallback; browsers retain authority
over ordinary/in-app tabs. There is no redirect, blank page, timer or polling loop.

## T. Terminal state

The terminal dialog heading receives focus and lives in the existing polite
success region. The confirmed email, business acknowledgement and close-page
instruction stay visible. Success and terminal layouts pass the requested sizes.

## U. Refresh and cold input

Reload uses the existing server-owned “Booking already confirmed” page, with no
new confirmation button and masked confirmed-email guidance. Initial fields and
Review are disabled only until hydration attaches their handlers, preventing
the demonstrated lost-input race. No Auth or confirmation transaction changes.

## V. Route inventory

Implemented routes: `/`, login/signup/forgot-password/reset-password/logout,
onboarding; dashboard/bookings/new/detail, customers/new/detail, insights,
business hub/editor/new, settings, notifications; `/c`, `/f`, `/a`, `/x` capability
families; admin overview/users/businesses/bookings/issues/emails/security and
their detail routes. Missing Profile legal/billing/account rows remain static;
no new destinations are invented. The full configured E2E run is complete (see AX); the 17-viewport
fixture matrix explicitly covers the ten vendor routes in section B plus success,
terminal and notification panel. Other route coverage must not be described as
that same complete matrix without corresponding evidence.

## W. Shared alignment

Only notification-history containment and confirmation terminal/hydration
behavior change. Approved gutters, Profile layout, Journey, share dialogs,
branding, icons and navigation are preserved. No global overflow hack.

## X. Booking Journey

PASS: existing canonical customer/booking/confirmation/fulfilment/feedback/insights journeys on Chromium and mobile Chromium, plus the existing Journey alignment assertions.

## Y. Overlays

Notification dialog/history focus, Escape, dismissal, scroll containment and
body-lock release pass in both engines. Existing share/lifecycle overlays are
included in the passing executable cases of the full configured E2E run.

## Z. Mobile nav

Geometry passes on all local matrix routes, including notification entry and
standalone/resume simulations. Physical intermittent defect remains unreproduced.

## AA. Primary responsive matrix

Each row passes strict document width, mobile-nav geometry where present,
notification panel and confirmation terminal containment in Chromium and WebKit.

| Viewport | Chromium | WebKit |
| --- | --- | --- |
| 320×568 | PASS | PASS |
| 360×800 | PASS | PASS |
| 375×812 | PASS | PASS |
| 390×844 | PASS | PASS |
| 414×896 | PASS | PASS |
| 430×932 | PASS | PASS |
| 768×1024 | PASS | PASS |
| 1024×768 | PASS | PASS |
| 1280×800 | PASS | PASS |
| 1366×768 | PASS | PASS |
| 1440×900 | PASS | PASS |

## AB. Small-height and landscape matrix

| Viewport | Chromium | WebKit |
| --- | --- | --- |
| 360×640 | PASS | PASS |
| 390×600 | PASS | PASS |
| 430×650 | PASS | PASS |
| 1024×600 | PASS | PASS |
| 1366×650 | PASS | PASS |
| 844×390 landscape | PASS | PASS |

## AC. Chromium

All 12 impacted browser cases have passed against the optimized build, including real popup close, Preferences dismissal and existing SW. The local HTTPS service-worker fixture required a test-process-only certificate exception; application cookie security is unchanged.

## AD. WebKit

All 12 impacted browser cases have passed against the optimized build. The shell case also produced intermittent prefetch errors in two HTTPS runs; a trace-enabled diagnostic run passed unchanged, so this remains unresolved verification instability, not a proven application fix. Cold-input regression resolved. This does not claim physical iPhone/browser-chrome verification.

## AE. Physical iOS

NOT AVAILABLE.

## AF. Physical Android

NOT AVAILABLE.

## AG. Existing installed PWA upgrade

Worker/manifest identity and cache behavior unchanged: one `/sw.js`, update via
cache disabled, install skipWaiting/activate claim, no fetch interception or
private caches. Existing registration.update → reload → standalone resize →
resume → cold resolver passes locally in both engines without unregister/reinstall.
This is an existing-worker simulation, not an OS-installed upgrade or real push tap.

## AH. Performance before/after

Local development-mode timings and decoded script bytes are recorded per route
in `output/playwright/golden-stability/{before,after}/<engine>/baseline.json`.
They include dev runtime/compiler effects and are not Production performance
numbers. Optimized HTTPS route response observations were 6–14ms in WebKit on loopback fixtures; these are not remote-user latency measurements. No microbenchmark-driven refactor.

## AI. Client bundle

No new dependency or server-to-client logic migration. Changes add a small terminal state/hydration guard and reuse the existing list response for the badge. Optimized resource timings are saved in `output/playwright/golden-stability/production/<engine>/baseline.json`, but warm-cache zero-byte entries prevent an accurate before/after bundle-size delta. No numeric bundle reduction is claimed.

## AJ. Console/runtime

No page errors in the development-mode vendor walkthrough. Optimized HTTPS WebKit reported two RSC prefetch “access control checks” errors during rapid document navigation in two runs. The diagnostic trace passed unchanged and showed successful same-origin 200 responses for those resources; a cause is not established. Keep this as a verification limitation, with no error filtering or speculative app change. Node NO_COLOR/FORCE_COLOR warnings are from the harness. The broad E2E logged a Next dev aborted response stream during recovery navigation; no corresponding client failure was demonstrated.

## AK. Accessibility

Semantic navigation labels/current state, explicit read/unread text, focusable
scrollable notification region, dialog Escape, terminal heading focus and real
button removal are checked. No new hidden interactive destinations.

## AL. Database changes

NONE APPLIED. A function/index migration is unexpectedly required despite the
existing timestamp; complete reviewed proposal and passing local tests are linked
above. This is explicitly awaiting user approval under the brief's migration rule.

## AM. Scheduler/configuration changes

NONE APPLIED. Scheduler remains active/every minute. Application maintenance
frequency change is described separately in M and is not yet deployed.

## AN. Environment changes

NONE. Local isolated tests use dummy fixture values; the existing broad E2E
uses configured cloud fixtures with email transport forced to development.
No Production secret is copied into Preview.

## AO. Provider/DNS changes

NONE. No real message or email was sent by the new fixtures.

## AP. Dependencies

NONE. Existing package and lockfile unchanged. Audit found zero vulnerabilities.

## AQ. Changed files

Application: notification API, client/count event, existing worker maintenance
stage, new retention clock helper, notification center and public confirmation
form. Tests: existing fixture server/browser suite, permanent stability suite,
confirmation component/cloud E2E tests, retention clock/SQL tests and optional
local proposal runner. Documentation: this report and affected feature/testing/
roadmap/data/security notes; proposal SQL is not an applied migration.

## AR. Tests

Focused component/HTTP/sender: 22 passed. Local SQL foundation + retention +
concurrent lease tests passed. Development notification browser suite: 22 passed before the new Preferences regression, which failed both engines before its fix and passes both on the optimized build. Optimized HTTPS suite: 22/24 on the first run; Chromium PWA passes after a local certificate harness correction, WebKit shell passes a trace-enabled diagnostic recheck with intermittent errors still recorded in AJ. These are not one clean 24-case run.

## AS. Focused regressions

Nav anchoring, cold notification business switch, Back/reload, SW update/resume,
strict overflow, history scroll, first-read/mark-all retention, no redundant
count request, close success/refusal/throw, rapid click, terminal focus, refresh.

## AT. Lint

PASS (`npm run lint`).

## AU. Typecheck

Initial run identified missing nullable fields in a new test fixture. Corrected;
`tsc --noEmit` recheck passes. Final production build also verifies types.

## AV. Unit/integration/security

PASS: 1,023 passed; 24 existing skipped tests (164 files passed, 21 skipped).

## AW. Runtime security

NOT VERIFIED: all 21 tests skipped behind the unchanged protected safe-target guard.

## AX. Full E2E

Full run: 68 passed, 19 existing skipped, one Auth fixture-creation Gateway Timeout before login. The unchanged affected login case passed on its single targeted recheck (8.7s), so all 69 executable cases have passed. No full-suite rerun or weakened test. Existing skips include controlled-inbox signup, MFA/admin operational authority, and duplicated mobile-project presentation coverage. The three database-backed confirmation/Done projects and Chromium/mobile Chromium/WebKit PWA journeys pass.

## AY. Build

PASS: `npm run build`, followed by real `next start` verification using the same build. Local HTTPS was added to the optional fixture mode because WebKit correctly rejects Production Secure cookies over plain HTTP. No application cookie policy was weakened; no certificate was installed in a trust store.

## AZ. Dependency audit

PASS: zero vulnerabilities at the moderate threshold.

## BA. Diff integrity

PASS: final `git diff --check`; no migration, scheduler object, provider, dependency, secret or generated screenshot is included in the executable change.

## BB. Bottom-nav stability gate

BOTTOM NAV STABILITY: FAIL — physical report remains unreproduced; local matrix passes.

## BC. Notification gate

NOTIFICATION RETENTION + PANEL STABILITY: FAIL — panel/API/local SQL tests pass,
but the physical-retention migration is unapproved and unapplied.

## BD. Confirmation gate

CUSTOMER CONFIRMATION TERMINAL UX: PASS — local Chromium/WebKit plus component
checks. The database-backed confirmation/Done journey also passes Chromium, mobile Chromium and WebKit, with one immutable confirmation and one email event.

## BE. Master gate

MASTER RESPONSIVE + ALIGNMENT GATE: FAIL — focused matrix passes; full release
and physical-device coverage are incomplete. No broad verification claim.

## BF. PR

PENDING; no merge permitted while migration/release gates remain open.

## BG. CI

PENDING. No check, skip, guard or branch protection is weakened.

## BH. Merge SHA

No new merge. Starting main is `20066c2f9be4cad28b17c5143742f234ec3371d3`.

## BI. Production deployment

No new deployment. Starting READY current deployment remains recorded in A.

## BJ. Production smoke

Read-only release preflight verified exact deployment/canonical assignment and
live scheduler/schema. Changed application behavior is NOT deployed or smoked.

## BK. Sentry

SENTRY — NOT VERIFIED. No Sentry connector or configured local read token is
available. Vercel logs are not substituted for Sentry health.

## BL. Cleanup

New fixture tests use only loopback memory and a disposable PostgreSQL cluster
that is removed by the runner. A read-only audit found zero remaining recognizable fixture users created during this run. The live scheduler was rechecked ACTIVE/every minute after the suite.

## BM. Remaining defects

Physical bottom-nav drift lacks a reproducible cause. Database correction requires approval. Optimized WebKit prefetch verification remains intermittent (AJ). The transient cloud Auth fixture failure passed its unchanged targeted recheck (AX).

## BN. Limits

No physical iOS/Android, real OS notification tap, real installed upgrade,
physical keyboard/browser-chrome test or direct Sentry observation. Local fixture
Auth is not RLS evidence; PostgreSQL contracts are verified separately. No blanket
claim that every implemented/admin/customer route passed every viewport.

## BO. Overall status

MY KUSTOMERS GOLDEN STABILITY PASS — MIGRATION APPROVAL REQUIRED

Merge and Production verification remain on hold pending approval of the complete SQL proposal and resolution of the remaining release gates. All limitations above remain explicit; no Production stability claim is made.
