# My Profile Phase 2 and social previews

STATUS: IMPLEMENTED — RELEASE VERIFICATION PENDING. No Phase 2 release yet.

## A. Repository and approved Phase 1

The starting branch was `ui/my-profile-phase-1`, with HEAD and freshly fetched
`origin/main` both at `ae9057faa228622f332d26ca446c85a9c59ded16`.
The 20 uncommitted Phase 1 files match the completed Phase 1 report; no staged
or unrelated changes were present. The approved My Profile heading, summary,
three groups, nine static rows and existing shell/navigation are present.
Work continues on `feat/profile-social-previews`, preserving those changes.

## B. Existing-feature map (audited before wiring)

| Profile row | Feature exists | Existing destination | Working evidence | Action |
| --- | --- | --- | --- | --- |
| Edit | Yes | BusinessWorkspace / BusinessOnboardingForm | Owner guard, current business query, shared validation, success/error states and existing form tests | Expose existing editor through minimal /business/edit wrapper; owners only |
| Business information | Yes | BusinessOnboardingForm information section / BusinessLogoForm | Name/category/description and authorized bounded logo pipeline | Link to /business/edit?section=information |
| Contact information | Yes | BusinessOnboardingForm contact section | Phone/email/WhatsApp/Instagram/website validation and same update action | Link to /business/edit?section=contact |
| Business address | Yes | BusinessOnboardingForm address section | Existing address_text field and same update action | Link to /business/edit?section=address |
| Account details | Partial account summary only | /settings displays email and logout | No account name/email/password management implementation | NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED |
| Notifications | Yes | /settings#notifications / NotificationSettings | GET/PUT preferences, three user preferences, device controls, failure recovery and existing contract tests | Link to existing settings section |
| Privacy & security | No vendor destination | Admin Security & Health is unrelated | No vendor security settings implementation | NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED |
| Billing & subscriptions | No | None; feature README explicitly defers billing | No usable billing implementation | NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED |
| Terms & conditions | No platform Terms page | Booking confirmation terms are unrelated | No current legal destination | NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED |
| About My Kustomers | No About page | None | No current About destination | NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED |

Evidence: `components/businesses/business-workspace.tsx`,
`components/forms/business-onboarding-form.tsx`,
`components/forms/business-logo-form.tsx`, `features/businesses/actions.ts`,
`features/businesses/server.ts`, `app/(dashboard)/settings/page.tsx`,
`components/notifications/notification-settings.tsx`, existing
`app/api/notifications/preferences/route.ts`, and the route inventory.
No missing feature will be built. Existing actions, queries, form validation,
membership checks and permissions remain authoritative.

## J–L. Starting social previews and root-cause evidence

Before Phase 2, confirmation metadata resolved an unguessable raw token to its hash,
then confirmation_links, then the matching booking and business. It does not use
vendor cookies. Valid previews offered two OG images: the stored vendor WebP first,
then the platform PNG. The first image has no dimensions; Twitter uses summary.
This creates a concrete platform-image fallback when a client rejects/selects
past the WebP. It is not proof of a particular physical WhatsApp client's choice
or cache contents. Physical Android/iOS root cause is not yet established.

The installed Next.js 16.3.4 bot list already handles WhatsApp,
facebookexternalhit and Twitterbot with blocking metadata. No global metadata
streaming override is indicated by that evidence. The application's previous crawler
list omitted Applebot, and the shared open-evidence POST had no crawler guard.
Those narrow attribution gaps are now corrected and covered by tests.

The public www URL currently returns one 308 redirect to the apex, then 200.
The final HTML already contains the approved My Kustomers title/description,
canonical og:url, My Kustomers site name, existing 1200x630 PNG, alt text and
summary_large_image Twitter metadata. Reuse this working root configuration.

The other capability metadata builders (/a, /x, /f) intentionally use generic
platform metadata under the existing privacy policy. They are not affected by
the confirmation-only two-image vendor fallback and will not be rebranded.

## M. Implemented confirmation preview

The implementation uses one Next.js ImageResponse PNG per valid confirmation preview. Resolve its
business through the existing confirmation record ID and reapply the same
expiry/revocation/booking-state checks. The image URL exposes neither the raw
capability nor its stored hash. Record IDs are not accepted as booking-confirmation
authority; this read-only endpoint reveals business identity only.
Stored WebP is decoded with the already installed Sharp dependency and embedded
as PNG. Missing or failed logos use business initials, retaining vendor identity.
No database, secrets, environment, DNS, providers or scheduler changes are needed.

## C–G. Wiring, route integrity, preservation and architecture

The three business rows and owner Edit reuse `BusinessWorkspace`,
`BusinessOnboardingForm`, `BusinessLogoForm`, `getCurrentBusinessProfile` and
`updateBusinessProfileAction`. The only wrapper is `/business/edit`, which
allowlists information/contact/address and defaults unknown values to information.
It exposes one visible My Profile back link and existing loading skeleton.
Notifications reuses `NotificationSettings` and its existing preferences/device
APIs at `/settings#notifications`.

The five unwired rows have no link, handler or tab stop. Each is
**NOT WIRED — FEATURE NOT CURRENTLY IMPLEMENTED**. There are no ambiguous mappings.

Local production-build browser evidence covers deep links, reload, keyboard Enter,
browser Back, existing shell, active Business navigation, owner saves for each
section, existing validation/error/retry state, member disabled inputs/no Save
control, signed-out redirect and business A/B selection. A business B save leaves
business A unchanged. Notification changes persist after reload and roll back on
server failure. The existing business form resets uncontrolled fields to stored
values after a failed server action; its alert and retry behavior are retained.
Cloud-backed authorization/RLS evidence remains separately recorded under CI.

No missing Profile feature was manufactured. Existing functionality was reused
rather than duplicated. No database schema, RLS, Auth, billing, notification,
customer, booking or tenant architecture changed. The bounded exception is one
read-only public image projection through the existing confirmation record UUID;
it grants no booking view, confirmation, email or customer-open authority.
No existing working route was deleted.

## H–I. Alignment and responsive matrix

MY PROFILE PHASE 2 ALIGNMENT GATE: PASS (local production rendering).

Link semantics initially added a divider pixel to minimum-height rows. The outer
list-item minimum now includes the divider exactly as in Phase 1. Owner Edit keeps
the original computed 16px/400 typography. Logo/name/Edit/row geometry matches the
saved Phase 1 baseline at all eight shared widths in both browser engines.
1280/1440 are additional Phase 2 coverage. Header markup, icon tiles, chevrons,
section order, typography and bottom navigation remain unchanged. The existing
Settings membership row wraps its badge/control below the name only below 375px,
fixing the observed 320px name squeeze; larger-width layouts and switching logic
are untouched.

| Viewport | Hub Chromium/WebKit | Information/contact/address | Notifications | Overflow, Back, reload, keyboard |
| --- | --- | --- | --- | --- |
| 320×568 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 360×800 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 375×812 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 390×844 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 414×896 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 430×932 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 768×1024 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 1024×768 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 1280×800 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |
| 1440×900 | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |

Artifacts: `output/playwright/my-profile-phase-2`. Hub full-page captures expand
height temporarily to place fixed navigation at the page edge; native viewport
geometry/scroll checks run separately. Screenshots at 320/390/768/1440, the 320px business editor and Notifications
and 1440px contact editor, and normal/no-logo/160-character social images were
visually reviewed. Exact geometry
is compared locally; CI does not treat different operating systems as a pixel
baseline. No physical phone rendering is claimed.

## J. Global Open Graph result

The existing root configuration remains unchanged:

- Title: My Kustomers — Booking & Customer Management for Service Businesses
- Description: Manage customers, bookings, confirmations, payments, delivery and
  feedback in one clear workspace built for growing service businesses.
- Image: `https://mykustomers.com/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png`
- PNG, 1200×630; site name My Kustomers; Twitter summary_large_image.
- `https://www.mykustomers.com` returns one 308 to `https://mykustomers.com/`, then
  200 with the same platform metadata. No DNS/domain change was needed.

## M–N. Final vendor metadata and multi-business proof

For a valid capability:

- Title: `Confirm your booking with {Business Name}`
- Description: `Review and confirm your booking with {Business Name}.`
- One absolute PNG: `https://mykustomers.com/social/confirmation/{previewId}`
- Width/height: 1200×630; alt: `{Business Name} business logo`.
- Twitter summary_large_image uses that same PNG.
- `og:site_name` remains My Kustomers as platform attribution; the image/title
  visibly identify the vendor. No og:url or canonical capability URL is emitted.
- Missing/failed logos use business initials. Invalid/revoked/expired link states
  retain generic safe page metadata and image 404. Already-used links retain the
  established already-confirmed preview policy.

Synthetic Harbour Studio and Northside Events capabilities produce different
booking-owned names/images without a login. A conflicting current-business cookie
cannot change the result. Image query overrides cannot substitute a name/logo/
business. A mismatched booking/business or another business's logo path fails
closed. The landscape WebP fixture retains its 2:1 aspect ratio within the PNG.
The image generator uses no raw capability or hash in its URL, text or alt.

## O–P. Crawler effects and capability security

Social crawler side effects: **NONE** in the exercised application paths.
Five representative crawler signatures × two businesses × two engines produce
blocking head metadata and valid PNGs; fixture write history remains empty after
GETs, image fetches and crawler POSTs. Unit tests also ensure neither RPC nor
rate-limit mutation is invoked by metadata lookup. Recognition is an attribution
layer, not an authentication boundary; unknown ordinary browsers retain the
existing protected customer-view behavior.

Successful and failed image responses preserve private no-store, no-referrer and
noindex/nofollow/noarchive/nosnippet/noimageindex. Production-rendered capability
pages retain their existing privacy headers. Metadata contains no customer
identity/contact, booking description/value/payment/notes/feedback, raw token or
stored hash. Existing Sentry sanitizers redact preview UUIDs and capability paths;
its current raw-capability transaction exclusions remain unchanged. Preview reads
are not added to sitemap or JSON-LD. Existing logo upload/storage/deletion policy
is unchanged (bounded current WebP, canonical business path, no raw upload retained).

## Q. Platform verification

| Client/platform | Metadata/image | Physical device |
| --- | --- | --- |
| WhatsApp Android signature | METADATA VERIFIED | NOT AVAILABLE |
| WhatsApp iOS signature | METADATA VERIFIED | NOT AVAILABLE |
| Applebot / Apple preview representative | METADATA VERIFIED | iMessage NOT AVAILABLE |
| Meta facebookexternalhit | METADATA VERIFIED | App display NOT AVAILABLE |
| X Twitterbot | METADATA VERIFIED | App display NOT AVAILABLE |

These are representative crawler signatures, not proof of every physical app's
current fetch signature, image-selection algorithm or cache. The exact reported
Android-vs-iOS physical root cause remains undetermined. What is proved is the
removed platform-PNG fallback after an undimensioned vendor WebP. No unsupported
claim that all Android WhatsApp versions reject WebP is made. Fresh physical-link
verification is pending; no real customer URL was modified for cache busting.

## R. Tests and verification

- Lint: PASS, 0 errors/warnings.
- Typecheck: PASS, Next route type generation and TypeScript.
- Unit/integration/static security: 158 files passed, 21 guarded files skipped;
  969 tests passed, 24 guarded tests skipped, 0 failures. No new skips.
- Focused initial metadata/resolution/hub/SEO run: 37 passed.
- Production build: PASS through the isolated browser harness's `npm run build`.
- Browser matrix: 23 passed, 0 failed, 0 skipped in the final full production-build
  run. The test waits for RSC prefetch completion before immediate reload/Back,
  avoiding harness-generated WebKit cancellation errors without filtering errors.
  After the final narrow Settings fix, both destination matrix cases passed again
  (2 passed, 0 failed), rebuilding the production app with that correction.
- `git diff --check`: PASS.
- Accessibility: semantic labelled/described links, keyboard focus/Enter, Back,
  correct disabled member controls, real status/alert states, untouched static-row
  tab order, visible shell controls and reachable ≥44px Save controls verified.
- React review: hub remains server-rendered; no destination data aggregation, new
  client state, effect, subscription or dependency. The existing client editor
  only accepts an initial section and uses the unchanged owner action.

The initial dev run's no-store assertion exposed Next dev's cache-header override;
the production build passes the actual privacy headers. Test assumptions were
corrected to the existing notification error copy and hidden member Save control.
The inherited full cloud E2E suite is not replaced by fixtures; CI results below
remain required. Guarded runtime-security tests are never described as passed.

## S–U. Database, environment, providers and dependencies

Database/schema/RLS/migrations: **NONE**.
Environment/secrets/DNS/provider configuration: **NONE**.
Dependencies/lockfile: **NONE**.
Scheduler: left active; no automation, cron or worker configuration was changed.

## V–Z. Commit, push, PR, merge and deployment

Release in progress. Commit, push, PR, CI, Preview, merge SHA and exact Production
deployment will be recorded here after each operation is verified. No merge or
Phase 2 Production deployment is currently claimed.

## AA–AB. Intentional gaps and real limitations

Account details, Privacy & security, Billing & subscriptions, Terms & conditions
and About My Kustomers remain intentionally unwired. There is no complete existing
feature to connect, and no substitute was invented.

Vercel's existing runtime variables are Production-only. A Preview can build and
serve public metadata but cannot currently authenticate Profile destinations or
resolve valid vendor previews. The user's requested Preview gate is therefore
not satisfied by a Ready build alone. No Production secrets were copied into
Preview and no environment change was made. Physical WhatsApp/iMessage verification
is also unavailable. These limitations must remain explicit in release decisions.

## AC. Final status

Release verification is in progress; no final production status is claimed yet.
