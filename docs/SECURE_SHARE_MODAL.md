# Secure-share modal redesign — 2026-09-12

STATUS: VERIFIED LOCALLY FOR THE REQUESTED MATRIX — OPTIONAL WEBKIT LIMITATION RECORDED

Scope: the approved vendor Feedback and customer Confirmation share dialogs.
Local branch: `feat/secure-share-modal`, based on `1a801fda2d6081fe21bd0e4d5d774ea75a8f7d5e`.
No release or Production deployment is part of this report.

## A. Files changed

Application:

- `components/forms/secure-share-content.tsx`
- `components/forms/secure-share-content.module.css`
- `components/forms/customer-confirmation-share.tsx`
- `components/forms/feedback-link-panel.tsx`
- `components/forms/confirmation-link-panel.tsx`

Tests:

- `tests/integration/customer-confirmation-share.test.tsx`
- `tests/integration/feedback-sharing.test.tsx`
- `tests/integration/secure-share-presentation.test.tsx`
- `tests/e2e/bookings.spec.ts`
- `tests/e2e/support/secure-share-audit.ts`

Documentation:

- `docs/SECURE_SHARE_MODAL.md`
- `docs/CHANGELOG.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/RESPONSIVE_QA.md`
- `docs/TESTING.md`
- `features/feedback/README.md`
- `features/confirmation-links/README.md`

No data-model, migration, architecture or roadmap change was needed: this is an
opt-in presentation refactor of existing features. Generated development files
are excluded from the final task diff.

## B. Shared presentation

`SecureShareContent` is a stateless presentation body inside the existing Radix
dialog. Only Feedback and Confirmation opt in. Their existing panel state,
server actions, capability lifecycle and evidence callbacks remain separate.
The pre-existing message state and channel/clipboard handlers stay in
`CustomerConfirmationShare`; their implementations are unchanged. Amendment and
add-on callers retain the original dialog content and close behavior.

## C. Feedback integration

The dialog has feedback-specific title, private/no-account description, contextual
customer/business message and Feedback link card. WhatsApp, Telegram, native
Share, Copy message, Copy link and the integrated copy icon call the existing
handlers. The real 1200-character maximum drives the counter. The URL remains
read-only and independent of edits. Both Close controls preserve the current
draft and URL; they create no share evidence and never regenerate/revoke a link.

## D. Confirmation integration

The approved **Share with customer** wording remains, with a confirmation-specific
message, description and Confirmation link card. All five share/copy actions
and both Close controls use the same preserved semantics as before. The existing
Generate → Share → custom-email editor → Regenerate/Revoke hierarchy is unchanged.
The separately labelled **Send confirmation to** editor is still available and
opens after closing the new modal. No email action was moved into the share grid.

## E. Security

**No raw-token persistence, token hashing, secure capability generation, expiry,
regeneration, revocation, confirmation evidence, feedback evidence, tenant
isolation, RLS, or database architecture was changed.**

No token queries, APIs, server actions, migrations, dependency, global modal,
cache, audit, email or booking implementation changed. No localStorage,
sessionStorage, telemetry or second capability system was added. Existing raw-URL
availability remains the authority for showing the trigger. Confirmation reload
still needs its existing fresh-link workflow; Feedback retains its existing
versioned server recovery behavior, with no client reconstruction. Scheduler
configuration was not modified or disabled.

## F. Alignment pass

- Bounded the centered shell to 640px, with at least 12px outer gutters and a
  shared dynamic-viewport/safe-area calculation for height and vertical center.
- Reserved 42px in the title for the 44px X target after the 320px geometry check
  caught insufficient clearance. The title and supporting copy share one column.
- Aligned Message/counter baselines, textarea edges and the pencil/helper row.
- Aligned link icon, label, help, URL baseline, divider and independent 44px copy
  target. The URL truncates visually without losing its full read-only value.
- Adjusted mobile inner gutters to 12px, five-column gaps to 4px and label tracking
  to fit WhatsApp at 390px without shrinking the 13px text. Five tiles remain equal.
- Centered the narrow 3 + 2 grid; aligned icons and label starts across each row.
- Matched the bottom Close width to the content and gave it a 46px minimum height.

SECURE SHARE MODAL ALIGNMENT GATE: PASS

## G. Polish pass

- Kept the current Inter typography, 16px mobile inputs and restrained 22/24px
  heading sizes; retained a real counter instead of the reference's illustrative limit.
- Used one calm pale-green link surface, consistent light borders, restrained
  shadow, rounded action tiles and a quiet pill-shaped Close action.
- Normalized contextual/copy icon strokes and channel icon circles; reused Lucide
  plus a small inline WhatsApp-style glyph without a new package.
- Kept native Share conditional, existing lightweight toasts and silent native
  cancellation; the remaining four channels stay available when unsupported.
- Removed mobile resize handles, kept desktop resizing and natural textarea
  scrolling for long messages, and used one bounded modal scroller.
- Captured the default draft with focus off the textarea and separate edited,
  focused and reduced-height states. Capability redaction affects screenshots only.

SECURE SHARE MODAL POLISH GATE: PASS

## H. Responsive gate

| Viewport | Feedback: Chromium + mobile Chrome | Confirmation: Chromium + mobile Chrome | WebKit confirmation |
| --- | --- | --- | --- |
| 320 × 568 | PASS | PASS | PASS |
| 360 × 800 | PASS | PASS | PASS |
| 375 × 812 | PASS | PASS | PASS |
| 390 × 844 | PASS | PASS | PASS |
| 414 × 896 | PASS | PASS | PASS |
| 430 × 932 | PASS | PASS | PASS |
| 768 × 1024 | PASS | PASS | PASS |
| 1024 × 768 | PASS | PASS | PASS |
| 1280 × 800 | PASS | PASS | PASS |
| 1440 × 900 | PASS | PASS | PASS |

Both variants meet the requested ten-width gate in Chromium and mobile Chrome.
The optional WebKit diagnostic completed the confirmation dialog's matrix and
focus/close checks, then timed out in the existing public reconfirmation step
before reaching Feedback. WebKit Feedback is NOT VERIFIED. No physical-device
or native-app delivery claim is made.

## I. Accessibility

The dialog exposes `role="dialog"`, `aria-modal="true"`, an accessible title and
description, labelled Message and read-only URL fields, helper description and
named copy/channel controls. Both Close targets are accessible as **Close**.
Radix moves focus inside, traps forward/reverse Tab, hides background content
from assistive navigation, closes on Escape/backdrop and returns focus to the
trigger. Browser tests check the actual focus sequence and draft/URL retention.
Existing visible focus outlines remain; all modal buttons are at least 44×44.

At 320×568 the actual modal scrolls, all channels and bottom Close are reachable,
the background stays locked, and no extra body scroller is introduced. Chromium
uses wheel input at the backdrop; WebKit uses PageDown at the modal edge because
its mobile driver has no wheel transport. A focused textarea is checked at
390×480 and again after restoring height. This is keyboard-layout simulation,
not verification with a physical iOS/Android software keyboard or VoiceOver.

## J. Regression

Feedback: contextual private copy, exact `/f/` URL, recovery/hash-only state,
reloaded active state, management-action wiring, expired/revoked/submitted
states, share evidence, crawler non-mutation, first-browser-open and actual
private submission remain covered by the existing component/domain and booking
journey tests.

Confirmation: contextual review copy, exact `/c/` URL, one-time raw state,
reload guidance, regeneration/revocation wiring, custom email, changed-recipient
fresh requests, customer review/confirmation, immutable evidence, lifecycle and
reschedule/reconfirmation remain covered by the existing suites.

New focused tests mount both link families for Bella Cakes/David and Garden
Studio/Ada simultaneously, verifying exact edited content and separate URLs
through WhatsApp, Telegram, native Share, both copy modes and the integrated
copy icon. No cross-business/customer or cross-family content is shared. Copy
message retains `trimmed message + two newlines + URL`; Copy link sends only the
URL. Native title/text/url, URL encoding, popup blocking, clipboard fallback,
failures and cancellation retain their existing behavior. Channel transport is
stubbed; no real WhatsApp/Telegram/native message is sent. Test email uses the
development provider. Guarded runtime tests are not presented as fresh RLS proof.

## K. Tests and final diff

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, no warnings/errors |
| `npm run typecheck` | PASS |
| `npm test` | 1020 passed, 0 failed, 24 SKIPPED; 163 test files passed, 21 skipped |
| Focused sharing/link-panel suites | 56 passed, included in the full unit run |
| Configured booking E2E (Chromium + mobile Chrome) | 7 passed, 0 failed, 1 SKIPPED |
| Final Chromium screenshot refresh | 1 passed, 0 failed, 0 skipped |
| Optional WebKit diagnostic | 0 completed tests passed, 1 failed, 0 skipped; see limitation below |
| `npm run test:security:runtime` | 0 passed, 0 failed, 21 SKIPPED |
| `npm run build` | PASS, optimized production build completed |
| `git diff --check` | PASS |

The existing booking-search viewport case runs only in Chromium, explaining its
mobile skip. The 21 runtime-security tests require explicit safe-target opt-in;
the guard was not bypassed. The ordinary suite's 24 skips are unchanged guards.
The optional WebKit run is not counted as a passed full journey: it timed out
waiting for the final **Confirm booking** button after **Review and confirm** on
a regenerated public confirmation page. Application code for that step is
unchanged. Its diagnostic config is retained only in the ignored screenshot
folder; no failing new CI gate or unrelated application fix was introduced.

Development checks caught and corrected title/X clearance and the 390px WhatsApp
label fit. A test-only Testing Library option was corrected during typecheck.
One early run hit an Auth gateway timeout before reaching the UI. WebKit's
unsupported wheel transport was replaced with PageDown for the background-lock
check, and its optional diagnostic blocks service workers so existing route
interception can observe requests. These experiments are distinct from the
final green configured booking run. No existing assertion was removed or skipped.

The final diff audit compares the actual source against the base: clipboard and
external-window helpers, message state and all channel/evidence handlers are
identical. Legacy amendment/add-on markup differs only in indentation. Protected
API/token/database/global-modal/dependency paths have zero changed files.
The final fixture check found zero scoped test Auth users and zero recent Phase 5
test businesses remaining after teardown. The scheduler was not modified.

## L. Screenshots

The local screenshot directory is
`output/playwright/secure-share-modal/`. `SCREENSHOTS.md` there lists every exact
absolute path as a clickable link, grouped by engine and variant. It contains
67 PNGs: 26 Chromium, 26 mobile Chrome, 13 WebKit confirmation, and 2 surrounding
confirmation-panel captures. The complete local A–L report is `REPORT.md` in the
same folder.

For each requested variant the Chromium and mobile Chrome sets contain default
and edited messages at **320, 390, 430, 768 and 1024**; a 320px scrolled action
view; a 390px focused textarea; and a 390×480 keyboard-layout simulation. The
confirmation-panel captures show the hierarchy before opening and the expanded
custom-email editor after closing. Fixed navigation/toast overlays are hidden
only in those tall element captures; the actual UI and assertions stay unchanged.

Raw capability values are redacted only during screenshot capture. Real inputs,
state and clipboard assertions retain the original legitimately generated URLs.
Native share is stubbed in browser layout captures; channel behavior is verified
with controlled transport in integration tests, not by sending real messages.
