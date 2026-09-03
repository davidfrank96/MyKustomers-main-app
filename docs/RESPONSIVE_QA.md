# Responsive QA

STATUS: VERIFIED FOR THE DEPLOYED BASELINE; BRANCH RELEASE MATRIX VERIFIED

Audit date: 2026-08-31.

The 2026-09-02 Auth hardening branch adds one compact Radix verification dialog
and a persistent Signup notice. Component coverage proves dialog semantics,
dismissal, exact long-address wrapping, form removal, and full-width resend at
the shared mobile presentation. Release browser verification must repeat Signup,
Login, Forgot password, Reset password, the dialog, persistent notice, and
throttling copy at 320, 360, 390, 430, 768, 1024, and 1440 pixels before this
branch is marked responsive-verified. Physical keyboard/PWA behavior remains a
separate real-device acceptance boundary.

This maintenance pass stabilizes the existing interface. It does not start the
planned broad visual redesign or Phase 11 PWA/UX hardening.

The separate 2026-08-28 evidence below covers the approved mobile redesign on
`ui/mobile-redesign`. It has not been merged or deployed.

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

| Route/state                               | Viewport              | Issue                                                                                         | Fix                                                                                                                            | Regression                                                                                                                       | Status      |
| ----------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| New Booking duplicate warning             | 320                   | Inline mode control forced the document to 351px; dynamic candidate action was too wide       | Stack modes below `sm`, constrain controls, and use a compact visible action with customer-specific accessible name            | Required-width inline E2E overflow and value-preservation loop                                                                   | IMPLEMENTED |
| Root entry                                | 320                   | Stale `Shell Preview` action wrapped tightly beside the brand                                 | Corrected action to `Log in` and current product copy                                                                          | Public-route overflow matrix                                                                                                     | IMPLEMENTED |
| Shared fields/selects/cards               | Narrow/long content   | Intrinsic widths could resist grid/flex shrinking                                             | Added `min-width: 0`, select truncation/wrapping, and bounded select content                                                   | Route matrix plus long-content audit                                                                                             | IMPLEMENTED |
| Generated link panels                     | Narrow flex rows      | Read-only URL inputs lacked an explicit flex shrink floor                                     | Added `min-width: 0`                                                                                                           | Booking lifecycle E2E and audit                                                                                                  | IMPLEMENTED |
| Public feedback/confirmation              | 320 long content      | Long values required explicit wrapping guarantees                                             | Added `overflow-wrap`/`break-words` while preserving content                                                                   | Public-route overflow matrix and visual audit                                                                                    | IMPLEMENTED |
| Dialog/sheet primitives                   | Short mobile viewport | No explicit viewport-height scroll boundary                                                   | Added max-height/vertical scrolling                                                                                            | Static inspection; no current product dialog journey                                                                             | IMPLEMENTED |
| Authenticated shell/account               | 320-430               | Logout and Settings were not discoverable below `sm`                                          | Added compact header account menu; retained five primary nav items                                                             | Authenticated mobile Settings/logout E2E                                                                                         | VERIFIED    |
| Business identity form                    | 320-1440              | New logo preview/file/actions and website required bounded wrapping                           | Responsive preview and stacked mobile actions with shrink-safe fields                                                          | Required-width authenticated route matrix plus real upload/replace/remove                                                        | VERIFIED    |
| Large business-logo preparation           | 390-1440              | Phone-sized sources must not freeze controls or exceed the serverless request ceiling         | Shared bounded preparation state, replaceable native input, <=3 MiB transport, and recoverable error/status announcement       | Exact-5 MiB onboarding at desktop plus 4.8 MiB replacement and >5 MiB rejection at 390px                                         | VERIFIED    |
| Dashboard metric tiles                    | 320-1440              | Static summaries had no data destination                                                      | Full semantic Link targets with visible focus and supported filters                                                            | Active/overdue/customers/insights browser navigation                                                                             | VERIFIED    |
| Public confirmation identity              | 320 mobile            | Logo/fallback and external links needed to remain secondary and wrap safely                   | Compact identity row with bounded logo and wrapping links                                                                      | Branded and fallback confirmation E2E                                                                                            | VERIFIED    |
| Live list and customer-picker search      | 320-1440              | Clear/pending controls and automatic candidates must not widen fields or reset booking values | Overlay icon controls, bounded candidate list, and shrink-safe search wrappers                                                 | Authenticated Bookings/Customers/New Booking live-search journeys at all required widths                                         | VERIFIED    |
| Structural route loading                  | 320-1440              | Async navigation needed feedback without layout shift, fake controls, or motion-only meaning  | Stable dashboard/list/detail/form skeletons, one accessible status, reduced-motion opt-out, and bounded grids                  | Component semantics plus desktop/mobile route E2E                                                                                | VERIFIED    |
| Business switch pending                   | Mobile/desktop        | Previous tenant content could remain visible while the next workspace resolved                | Opaque fixed pending layer driven by the shared switch form status                                                             | Multi-business desktop/mobile E2E and component review                                                                           | VERIFIED    |
| Booking journey stepper/action            | 320-1440              | Seven lifecycle labels and a primary action needed hierarchy without horizontal compression   | Vertical semantic stepper, two-column desktop composition, full-width mobile primary action, and secondary action disclosure   | Canonical booking and cancellation E2E in desktop/mobile projects at 320, 360, 375, 390, 430, 768, 1024, and 1440                | VERIFIED    |
| Completion dialog and required logo setup | 320-1440              | Terminal confirmation and logo controls must remain visible without browser UI or overflow    | Radix dialog with stacked mobile actions; bounded shared logo preview/input and staged setup                                   | Booking cancel/confirm at 320 plus onboarding and full responsive route matrix                                                   | VERIFIED    |
| Native image picker and completion success | 320-1440              | Styled browser file chrome could vary by engine; completion feedback must not repeat on history | Unique native label/input picker; compact transition-only Radix success dialog                                                  | Desktop/mobile Chromium/WebKit filechooser, three-project PWA picker matrix, canonical completion/refresh journey                | VERIFIED    |
| Booking detail progressive disclosure     | 320-1440              | Accumulated operational sections made the initial page excessively long                       | Persistent journey plus 56px disclosure headers, concise summaries, contextual default-open logic, and independent expansion   | Canonical desktop/Pixel 5 journey plus 320/360/375/390/430/768/1024/1440 overflow checks                                         | VERIFIED    |
| Operational timeline presentation         | 320-1440              | Raw event cards were visually repetitive and slow to scan                                     | Compact semantic timeline with aligned nodes, adaptive connectors, event icons, real metadata, and natural long-title wrapping | Mixed 16-event canonical fixture, disclosure ARIA, screenshots at 320/390/768/1024, and eight-width overflow gate                | VERIFIED    |
| Final authenticated release matrix        | 320-1440              | The branch-specific matrix omitted the required 1280x800 desktop width                        | Added 1280x800 while retaining all eight existing widths and every authenticated route/state assertion                         | Nine widths x eleven authenticated routes, overflow checks, actions, sticky/fixed navigation, and fresh screenshots              | VERIFIED    |
| Bookings/Customers Load more              | 320-1440              | Ten-row page navigation fragmented large directories; appended rows must remain bounded       | 25-row server-first list plus semantic Load more, localized retry, live announcement, deterministic cursor, and tenant reset   | 25 -> 50 -> final E2E, rapid-click guard, concurrent-insert duplicate check, eight-width overflow, and 125-row 390px measurement | VERIFIED    |

## Evidence

The 2026-08-31 final branch audit exercises Dashboard, Bookings, New Booking,
Booking detail, Customers, New Customer, Customer detail, Insights, Business,
Add another business, and Settings at 320x568, 360x800, 375x812, 390x844,
430x932, 768x1024, 1024x768, 1280x800, and 1440x900. The self-cleaning fixture
asserts no document overflow, usable compact controls, non-overlapping fixed
navigation/actions, stable attention counts, and no legacy `My Customers`
runtime label. Public homepage coverage independently includes the same primary
widths plus 1600px; canonical confirmation and feedback journeys cover their
responsive, validation, expired/revoked, share, and submission states.

Representative 320, 390, 1024, 1280, and 1440 screenshots were visually
reviewed for hierarchy, clipped text, whitespace, fixed navigation, disclosure
layout, and form/action alignment. Regenerate/revoke feedback actions stack at
390px and align as a two-column group from 430px before returning to intrinsic
desktop controls. No page-level horizontal overflow was observed.

The 2026-08-28 approved mobile-redesign pass exercised Dashboard, Bookings,
Booking detail, Customers, Insights, Business, and Add another business at 320,
360, 375, 390, and 430 pixels. The controlled Playwright fixture asserted zero
document overflow at all 35 route/viewport combinations, exactly five mobile
navigation destinations, a fully rendered authenticated shell, and responsive
handling of a long business name, long booking title/reference, and
`NGN 99,999,999,400`. It also captured every approved screen plus Booking detail
with a disclosure expanded. Evidence is generated under the ignored
`test-results/mobile-redesign` directory and was visually reviewed; no
production data or product behavior was changed. Physical-device keyboard and
screen-reader acceptance remain release-review work.

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

The 2026-08-23 live-search pass exercised authenticated Bookings, Customers, and
New Booking search states at 320, 360, 375, 390, 430, 768, 1024, and 1440 pixels.
The focused live journeys reported zero horizontal-overflow assertions and
preserved booking field values while customer candidates updated. Physical
mobile-keyboard and screen-reader acceptance remain release-hardening work.

The 2026-08-25 booking-journey pass exercised authenticated booking detail at
320, 360, 375, 390, 430, 768, 1024, and 1440 pixels inside canonical desktop and
mobile lifecycle journeys. Current-step semantics, primary-action fit, secondary
cancellation access, attention copy, and document overflow passed.
The post-deployment production smoke repeated document-overflow checks at all
eight widths against merge `b26f0c4`; desktop and mobile production captures
confirmed the two-column and action-first vertical compositions without crushed
labels or horizontal overflow. Controlled fixtures were removed afterward.

The 2026-08-25 urgent maintenance adds an explicit 320px completion-dialog
assertion and reuses the existing 320, 360, 375, 390, 430, 768, 1024, and 1440
onboarding/business matrix for the required logo section. PR #23 passed E2E and
the other required executable CI jobs before merge `9dae103`. Post-deployment
production smoke repeated the dialog Cancel/final paths and document-overflow
check at 320px, then verified first/additional logo controls and switching at
1440px. Controlled fixtures were removed afterward. Physical-device and
standalone installed-PWA acceptance remain release-hardening work; application
behavior no longer depends on browser popup presentation.

The 2026-08-26 booking-detail clarity detour keeps the journey visible and
collapses secondary payment, progress, confirmation, changes, add-ons, feedback,
issues, reschedule, details, and timeline content. Chromium and Pixel 5
canonical journeys passed, including the explicit eight-width overflow matrix,
minimum-height disclosure targets, current-context opening, and manual access to
every preserved action. PR #33 passed required CI, deployed as merge `84aa736`,
and the controlled production desktop and mobile canonical journeys passed.

The 2026-08-31 Operational timeline presentation refactor keeps the existing
oldest-to-newest server ordering and mixed status, reschedule, amendment, and
add-on records. Focused component coverage verifies dynamic singular/plural
counts, semantic list order, optional detail, long wrapping, and the safe empty
state. The canonical booking journey exercises a 16-event mixed fixture at 320,
360, 375, 390, 430, 768, 1024, and 1440 pixels, captures expanded 320/390/768/
1024 and collapsed 390 evidence, and rejects page-level horizontal overflow.

The 2026-08-26 business-logo hotfix retains the existing contained preview,
native picker, and full-width mobile action layout. Automated coverage performs
initial upload at 1440px and replacement/removal at 390px while asserting that
pending controls settle and the stored object changes in place. The broader
authenticated route matrix continues covering 320, 360, 375, 390, 430, 768,
1024, and 1440 pixels. After PR #35 passed required CI and deployed as merge
`faad4cb`, the controlled production smoke passed onboarding and existing-
business upload at 1440px plus replacement and removal at 390px without browser
errors or overflow; cleanup left no controlled fixture records or objects.

The 5 MiB source follow-up keeps the same contained preview and stacked mobile
actions. Browser coverage adds an exact-boundary desktop onboarding source and a
4.8 MiB replacement at 390px, asserts the visible preparation state settles,
inspects the actual multipart body, and proves an over-limit selection creates
no request. Physical low-memory iPhone/PWA acceptance remains release-hardening
work; the implementation uses `createImageBitmap` with an Image/object-URL
fallback and introduces no image-processing dependency.

After PR #37 merged as `dd0fe2c`, the exact Production deployment repeated the
desktop exact-5 MiB onboarding journey and 390px 4.8 MiB replacement. The mobile
page had no horizontal overflow or console errors, and the replacement settled
in 15.049 seconds under 180ms latency and 1.2 Mbps upload throttling. The
over-limit control recovered without a request. Physical low-memory device and
installed-PWA acceptance remain release-hardening work.

## PWA Resume Reliability Matrix

Desktop Chromium, Pixel 5 Chromium emulation, and iPhone 13 WebKit emulation
cover the authenticated shell, browser Back, long resume, reconnect, business
switch, booking detail, dirty booking form, Business logo picker, and expired
session. The shell reserves the fixed mobile navigation plus bottom safe area;
the mobile header and sheets include top/bottom safe areas. Dynamic viewport
units remain authoritative and no horizontal overflow is accepted.

The automated keyboard check can establish focus/scroll containment in the
emulated viewport, but it cannot reproduce a physical iPhone software keyboard
or Safari snapshot process. Real iOS homescreen launch, lock/unlock, keyboard,
and photo-library selection remain pending. HEIC/HEIF is safely rejected; the
supported PNG/JPEG/WebP flow is unchanged.
