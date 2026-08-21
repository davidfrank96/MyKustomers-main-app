# Responsive QA

STATUS: VERIFIED

Audit date: 2026-08-21.

This maintenance pass stabilizes the existing interface. It does not start the
planned broad visual redesign or Phase 11 PWA/UX hardening.

## Matrix

- Mobile: 320, 360, 375, 390, and 430 pixels.
- Tablet: 768 and 834 pixels.
- Desktop: 1024, 1280, and 1440 pixels.
- Routes: root, authentication, onboarding, dashboard, customer list/new/detail
  and archive filter, booking list/new/detail and inline customer modes,
  business, settings, insights, confirmation states, and feedback states.
- Stress content: long business/customer names, long email/phone, long booking
  title/description/comment, NGN 12,500,000, and EUR 250,000.

## Findings

| Route/state | Viewport | Issue | Fix | Regression | Status |
| --- | --- | --- | --- | --- | --- |
| New Booking duplicate warning | 320 | Inline mode control forced the document to 351px; dynamic candidate action was too wide | Stack modes below `sm`, constrain controls, and use a compact visible action with customer-specific accessible name | Required-width inline E2E overflow and value-preservation loop | IMPLEMENTED |
| Root entry | 320 | Stale `Shell Preview` action wrapped tightly beside the brand | Corrected action to `Log in` and current product copy | Public-route overflow matrix | IMPLEMENTED |
| Shared fields/selects/cards | Narrow/long content | Intrinsic widths could resist grid/flex shrinking | Added `min-width: 0`, select truncation/wrapping, and bounded select content | Route matrix plus long-content audit | IMPLEMENTED |
| Generated link panels | Narrow flex rows | Read-only URL inputs lacked an explicit flex shrink floor | Added `min-width: 0` | Booking lifecycle E2E and audit | IMPLEMENTED |
| Public feedback/confirmation | 320 long content | Long values required explicit wrapping guarantees | Added `overflow-wrap`/`break-words` while preserving content | Public-route overflow matrix and visual audit | IMPLEMENTED |
| Dialog/sheet primitives | Short mobile viewport | No explicit viewport-height scroll boundary | Added max-height/vertical scrolling | Static inspection; no current product dialog journey | IMPLEMENTED |
| Authenticated shell/account | 320-430 | Logout and Settings were not discoverable below `sm` | Added compact header account menu; retained five primary nav items | Authenticated mobile Settings/logout E2E | VERIFIED |
| Business identity form | 320-1440 | New logo preview/file/actions and website required bounded wrapping | Responsive preview and stacked mobile actions with shrink-safe fields | Required-width authenticated route matrix plus real upload/replace/remove | VERIFIED |
| Dashboard metric tiles | 320-1440 | Static summaries had no data destination | Full semantic Link targets with visible focus and supported filters | Active/overdue/customers/insights browser navigation | VERIFIED |
| Public confirmation identity | 320 mobile | Logo/fallback and external links needed to remain secondary and wrap safely | Compact identity row with bounded logo and wrapping links | Branded and fallback confirmation E2E | VERIFIED |

## Evidence

The final automated audit traversed 265 route/viewport states, generated 160
fresh screenshots in `/private/tmp/mycustomers-responsive-qa`, and reported
zero horizontal-overflow failures. Representative mobile, tablet, desktop,
inline-customer, confirmation, feedback, and large-currency screenshots were
visually inspected. Temporary QA artifacts are not committed. Physical-device,
screen-reader, and production-browser acceptance remain release-hardening work.

The business-identity maintenance pass additionally exercised authenticated
Settings, Business, and Dashboard at 320, 360, 375, 390, 430, 768, 1024, and
1440 pixels with zero horizontal-overflow assertions, plus live logo upload,
replacement, removal, mobile logout, dashboard destination, and public
confirmation identity journeys. It did not repeat the earlier 834/1280 matrix,
which remains covered by the broader responsive suite.
