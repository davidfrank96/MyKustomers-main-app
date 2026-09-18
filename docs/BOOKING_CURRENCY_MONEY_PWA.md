# Booking currency, money input and PWA navigation — 2026-09-18

Status: IMPLEMENTED — VERIFICATION IN PROGRESS. This report separates observed
faults from the original reported receipt/PWA symptoms; it is not a Production
release claim.

## A. Starting state

Clean `loop-experience/hompage` at `5f59ff66975a3a0bdf9e4ba962dabb72e38a727a`.
Fetched main `cea7ad4b50e40daedfce3031a39c8fee68c7fb8e`; identical application
contents, with PR #85's merge history. Created `fix/booking-currency-money-pwa`
from main, then renamed this task branch to `booking-currency-money-pwa` to
avoid the existing case-insensitive `Fix/` namespace collision on macOS. Production metadata verified main's exact SHA on READY Production
`dpl_SX7HRb5pbBrbkKKVzgmW8mcjuTqH`, aliased to `mykustomers.com` and `www`.

## B. Currency model audit

`bookings.currency` is a non-null NGN/EUR/GBP/USD enum. Create validation and
`create_booking_with_customer` carry the submitted currency. Detail/list queries
project it. Payment rows store integer amounts; `get_booking_payment_summary`
derives currency from the parent. Add-on creation derives parent currency and
existing database integrity enforces it. No missing persistence or migration found.

## C. Booking currency source of truth

Booking or authoritative booking-scoped financial context, including immutable
confirmed terms. No browser/business/user preference or exchange rate is consulted.
Existing explicit, customer-approved material amendments remain available;
this pass does not rewrite that lifecycle or reinterpret historical evidence.

## D. NGN fallback defects found

- BOOKING-SPECIFIC BUG: amendment comparison silently guessed NGN when snapshot
  currency was missing. It now shows `Unavailable` for missing/unsupported currency.
- LEGITIMATE DEFAULT: New Booking's initial NGN and SQL creation defaults;
  explicit enums, symbol/locale mappings and NGN symbol normalization are also
  legitimate currency definitions, not post-creation denomination fallbacks.
- PLATFORM COPY: none of the audited application NGN occurrences was marketing copy.
- TEST FIXTURE: NGN values in tests are controlled denomination examples. Added
  matching USD/GBP/EUR regression evidence rather than replacing fixtures blindly.
- Other `Intl.NumberFormat` calls format analytics counts/percentages and admin
  counts; booking money delegates to the explicit shared formatter.

## E. Receipt root cause

The original USD→NGN receipt record/surface has not been supplied or reproduced.
Public confirmation, payment summaries and confirmed email use explicit currency.
A separate exact-money bug was reproduced at the safe integer limit:
9,007,199,254,740,991 minor units rendered `.90` instead of `.91` after division by 100. This is a precision defect, not the reported currency-switch root cause.

## F. Receipt fix

The shared exact formatter splits integer major/minor units with BigInt and uses
Intl currency parts, preserving every cent at the supported limit. Normal
whole-number and two-decimal conventions are retained. No receipt-specific
currency workaround or historical data rewrite was added.

## G. Booking Details currency result

Controlled NGN/USD/GBP/EUR create → persisted row → direct detail → reload passed.
Total 500,000.25 and deposit 200,000.10 retained exact integer minor units.

## H. Customer confirmation currency result

All four generated confirmation pages and reloaded confirmed receipts preserved
500,000.25 / 200,000.10 / 300,000.15 with the expected denomination. Component
regressions also cover larger exact decimal records and reject NGN leakage.

## I. Payment currency result

All four controlled bookings recorded 100,000.05 as 10,000,005 minor units.
Entry inherits the authoritative summary currency; no payment currency selector.
Existing summary/history formatting remains exact.

## J. Add-on currency result

All four controlled parent bookings created a 1,500.25 add-on; persisted add-on
currency matched the parent. Entry and summaries have four-currency component
coverage. No independent denomination or conversion added.

## K. Email currency result

Confirmed email HTML/text retains exact amounts in all four denominations.
Existing amendment/add-on email templates consume explicit terms/parent currency;
no provider, sender, routing or outbox behavior changed. Test email provider is
`development`; no real customer is used.

## L. Insights currency assessment

Existing RPC grouping separates currencies. The shared formatter is reused.
No combined-currency total or FX introduced.

## M. Shared formatter changes

One existing money module: explicit currency symbol mapping, validated currency
type guard, integer compact reading aid and exact-cent formatting. No dependency.

## N. Money-input starting behavior

Comma-grouped text input with hidden canonical decimal value, decimal input mode
and integer server parser. A grouping-only deletion could fail to restore the
caret because the effect depended only on an unchanged display string.

## O. Final exact input behavior

Grouping, decimal editing, clearing, selected text deletion and canonical submission
remain intact. Caret restoration runs for each edit; forward deletion can move
past a restored grouping comma. Invalid shorthand remains invalid input, not money.

## P. Compact helper behavior

Examples: ₦5M, $1.5M, £250K, €2.25M. K/M/B/T, at most two rounded decimals,
trailing zeros removed; threshold rollover avoids `1000K`. Empty, invalid and
sub-thousand values omit the helper. Currency changes update the symbol only.
The helper is a described, non-editable reading aid without per-keystroke live
announcements. Financial records retain exact amounts.

## Q. Persisted-money integrity

Hidden canonical input and existing integer parser/action/RPC contracts unchanged.
Compact strings never enter submission. No floating-point persistence or FX.

## R. iPhone notification entry audit

Audited system click, resolver, PWA reliability coordinator, shared shell/nav and
notification dialog. Exact booking/business resolution remains unchanged. Physical
installed-PWA cold/resume/foreground entry has not been observed in this task.

## S. Service-worker notification-click result

Worker validates notification UUID, targets `/notifications/open/<id>`, focuses an
existing exact-target client or opens that resolver URL. It deliberately does not
navigate an unrelated dirty form window. No SW rewrite or duplicate-window policy
change. Resolver authorization/business selection remains authoritative.

## T. Bottom-nav root cause

Physical iPhone displacement remains unreproduced. A related, independently
reproduced cleanup defect exists: native notification row activation left the
Radix dialog open while navigation was pending, unlike the Preferences link.
Do not conflate this with proof of the OS-push viewport symptom.

## U. Shared-shell fix

The shared notification center closes on ordinary same-window row activation,
releasing its modal scroll/pointer lock before document navigation. Modified
clicks keep the original window state. Back navigation must not restore the dialog.
No booking-page offsets, body overflow hacks or speculative viewport positioning.

## V. Safe-area result

Existing fixed bottom=0 nav keeps safe-area padding inside its surface. No ancestor
transform/filter/contain or stale visualViewport offset found. CSS unchanged.

## W. Keyboard result

Browser text/money focus, reduced viewport, blur and restored size checks pass in
Chromium/WebKit. These simulate available geometry; physical software-keyboard
and installed-PWA recovery are NOT VERIFIED.

## X. Scroll result

Shared geometry checks scroll repeatedly and assert nav bottom within 2px of
viewport bottom, with no leftover inline body lock. Final full-suite result below.

## Y. PWA resume result

Existing coordinator/listener and worker tests preserved. Synthetic pageshow/resume
is browser evidence only; OS notification background/cold launch remains unverified.

## Z. In-app notification result

Delayed-resolver cleanup passes in Chromium and WebKit. Exact booking deep-link
and business resolver behavior retained. Normal/Back/viewport matrix passed in both engines.

## AA. Chromium result

Focused money/caret and notification cleanup passed. Complete production-build
HTTPS notification suite passed (14 tests in this engine).

## AB. WebKit result

Focused money/caret and notification cleanup passed. Complete production-build
HTTPS notification suite passed (14 tests in this engine).

## AC. Physical iOS result

NOT AVAILABLE. PHYSICAL iOS PUSH/NAV — NOT VERIFIED.

## AD. Physical Android result

NOT AVAILABLE. Chromium mobile emulation is not physical Android verification.

## AE. Responsive matrix

New money input checks: 320×568, 360×800, 375×812, 390×844, 414×896, 430×932,
768×1024, 1024×768, 1280×800, 1440×900, plus 390×600, 430×650 and existing
additional short/landscape sizes, in Chromium and WebKit. Shared shell and form
matrix runs in the notification suite; canonical E2E covers payment/add-on/detail
and public confirmation layouts. Screenshots are local QA artifacts.

## AF. Alignment/polish pass

Currency prefix replaces generic money icons in edit fields to avoid overlapping
adornments. Helper stays secondary below the exact input. Production-rendered matrix passed; reviewed 320px and 390px WebKit screenshots
for prefix/value/helper alignment. Full exact input remains readable without page
overflow, and nav remains at the viewport edge.

## AG. Database changes

NONE. No migrations or historical changes.

## AH. Environment changes

NONE. Existing process-only development-provider settings used for controlled
local tests; no remote settings or Production secrets copied to Preview.

## AI. Scheduler changes

NONE. Existing scheduler left active and untouched.

## AJ. Provider changes

NONE.

## AK. Dependencies

NONE.

## AL. Files changed

Shared money/input modules; BookingForm, amendment/add-on/payment consumers;
notification center; focused unit/integration/E2E/browser regressions; this report,
CHANGELOG, DESIGN_SYSTEM, TESTING, RESPONSIVE_QA and bookings feature README.

## AM. Tests added/updated

Four-currency exact receipt/email/payment/add-on assertions, canonical/compact
input behavior and limits, unknown amendment currency, browser comma deletion,
responsive input matrix, pending-navigation modal cleanup, and persisted lifecycle.

## AN. Lint

Passed.

## AO. Typecheck

Passed.

## AP. Unit/integration

1,070 passed; 24 guarded/conditional skips (166 passing files, 21 skipped).
Precision/receipt/payment focused run: 60 passed.

## AQ. Runtime Security

21 guarded runtime files/tests skipped. NOT VERIFIED LIVE; no dedicated test
project configured. Never enabled this destructive runtime suite on Production.

## AR. E2E

Focused persisted four-currency lifecycle passed (45s), cleanup succeeded.
Full existing E2E run in progress using isolated local server/development email.

## AS. Build

Isolated production build passed with local fixture credentials. Complete HTTPS
notification/shell suite: 28 passed, Chromium and WebKit (1.2m). Matrix waits for
Next's deferred prefetch before deliberate document unload, matching the existing
Profile test approach; zero-page-error assertions remain intact. Keyboard input
checks wait for the currency menu's focus restoration before editing. The exact
caret assertions are retained. Six additional isolated repeated money runs passed.

## AT. Dependency audit

Passed: 0 vulnerabilities, moderate threshold.

## AU. Diff check

Passed; final check pending.

## AV. PR

[Draft PR #86](https://github.com/davidfrank96/MyKustomers-main-app/pull/86).
Draft/unmerged because physical symptom reproduction remains open.

## AW. CI

Pending.

## AX. Merge SHA

Not merged.

## AY. Production deployment

Unchanged baseline `cea7ad4`; no deployment of this branch.

## AZ. Production currency smoke

Controlled persistence E2E uses the existing configured Supabase project but the
local application. This is not a Production-domain smoke of this patch.

## BA. Production navigation smoke

NOT VERIFIED for this patch.

## BB. Sentry/logs

SENTRY — NOT VERIFIED. No new Production deployment to attribute logs to.

## BC. Cleanup

Focused lifecycle fixtures removed by existing afterAll cleanup. Full-suite cleanup
and temporary-server exit to be checked before finalization. No real records edited.

## BD. Remaining limitations

Original USD→NGN receipt record and physical iPhone OS-push displacement are
unreproduced. The supplied release instruction explicitly allows unavailable
physical hardware only when the defect is otherwise reproduced/proven; therefore
this pass must not claim a fully verified Production fix for that original symptom.

## BE. Final status

Pending completion of local/CI checks; no Production verification claim.
