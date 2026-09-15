# Secure social previews — implementation and manual review

STATUS: VERIFIED — LOCAL; MANUAL REVIEW PENDING

Date: 2026-09-15. Branch: `feat/secure-social-preview-refresh`, based on production
commit `90ff4f8e680f9bf210db78968e23b42f4764d66c`. No push, merge, deployment,
production data write, migration, dependency change or scheduler change.

## A. Architecture

- `/c/[token]` retains App Router `generateMetadata`; `/f/[token]` retains its
  existing server-rendered HTML metadata builder. Each hashes the supplied token
  and performs its existing separate read-only lookup, with exact link/booking/
  business binding, state checks and feedback-purpose validation.
- Valid metadata advertises one PNG at `/social/confirmation/[previewId]` or
  `/social/feedback/[previewId]`. The existing record UUID is only a public-brand
  locator and grants no customer-view or action authority. No raw capability
  URL is added to canonical, `og:url` or image metadata.
- Each Node image route rechecks its own context, uses the existing bounded logo
  projection, and calls a shared native `ImageResponse` renderer receiving only
  `{ businessName, logo: Buffer | null }` and the variant. The output is 1200×630.
  No screenshot engine, per-share file persistence or new package is used.
- Missing/expired/revoked/unsafe context gets generic metadata advertising
  `/social/confirmation` or `/social/feedback`; these anonymous generic image
  routes make no backend lookup. Invalid existing dynamic image IDs/states retain
  their empty 404 contract. Logo failures use initials; render-stream failures
  return the existing branded platform PNG, with no exception logging.
- All image responses keep no-store, no-referrer and noindex headers. Both OG and
  Twitter use the same image; `og:type=website`, `twitter:card=summary_large_image`.
- The installed Next default blocking-metadata regex is extended with the
  existing safe-shell crawler regex. This fixes the tested standalone Telegram
  case without dropping Next defaults or blocking metadata for ordinary browsers.

## B. Confirmation preview

For business `Harbour Studio` (synthetic review fixture):

- OG title: `Review your booking with Harbour Studio`
- OG description: `Harbour Studio has sent you booking details for secure confirmation.`
- Image: `/social/confirmation/[previewId]`
- Image descriptor/action: `Booking confirmation` / `Review your booking`
- Image supporting sentence: `Harbour Studio has sent you booking details for confirmation.`
- Trust footer: `Secure confirmation` / `Powered by MyKustomers.com`

![Confirmation card](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-square-600.png)

[Full 1200×630](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-square-1200.png) · [600×315](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-square-600.png) · [300×158](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-square-300.png)

## C. Feedback preview

- OG title: `Share private feedback with Harbour Studio`
- OG description: `Harbour Studio would appreciate your private feedback about your experience.`
- Image: `/social/feedback/[previewId]`
- Image descriptor/action: `Private feedback` / `Share your feedback`
- Image supporting sentence: same as the OG description.
- Trust footer: `Private feedback request` / `Powered by MyKustomers.com`

![Private feedback card](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-square-600.png)

[Full 1200×630](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-square-1200.png) · [600×315](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-square-600.png) · [300×158](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-square-300.png)

## D. Privacy

Every field included in a vendor preview is: cleaned public business display
name; validated, business-owned public logo PNG (or name-derived initials);
variant descriptor; generic action heading; generic supporting sentence using
only the business name; variant trust label; static lock/purpose illustration;
`Powered by MyKustomers.com`; official MyKustomers platform artwork. No further
business/capability data is passed to the new renderer. Generic cards use only
platform identity and generic variant copy.

Customer name, email, phone, amounts, booking/reference/details, address, notes,
secure URL/token/hash, feedback answers and operational history are **not rendered
in the OG image**. Neither the preview UUID nor the storage URL is rendered.
Actual PNG comparison tests prove that unrelated private inputs do not affect
output. Third-party caches may retain safe public identity; action security never
relies on cache invalidation.

## E. Crawler safety

**Open Graph / social crawler requests do not record first-view evidence, consume
capabilities, alter lifecycle state, or mutate confirmation/feedback records.**

In isolated real-server tests, both fresh capability snapshots retain null
`first_viewed_at`, `used_at`, `revoked_at`, `last_shared_at`, zero `share_count` and
the exact original expiry after metadata/image fetches and guarded open POSTs.
There are zero RPC/table writes and zero lifecycle events. Tested signatures:
WhatsApp Android/iOS, Telegram, Applebot/iMessage preview, Meta, Twitter, Slack,
Discord and LinkedIn. Both Chromium and WebKit then load the actual public page
and invoke the normal open RPC exactly once, recording first-view evidence only.

[Confirmation evidence](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-crawler-evidence.json) · [Feedback evidence](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-crawler-evidence.json)

These are local loopback fixtures exercising real application routing and
rendering, not a live Supabase/RLS certification. Protected live runtime flags
were not enabled.

## F. Final share messages

Confirmation (the existing composer appends the controlled URL separately):

```text
Hi {customerFirstName} 👋

Your booking with {businessName} is ready for review.

Review and confirm your details here:

{secureUrl}
```

Feedback:

```text
Hi {customerFirstName} 👋

{businessName} would appreciate your private feedback about your experience.

Share your feedback here:

{secureUrl}
```

Without a customer name, the greeting is `Hi 👋`. Existing vendor edits remain
owned by the dialog and survive its existing open/close/rerender behavior. OG
identity is resolved from the capability independently of the outgoing text.

## G. Social channels

WhatsApp, Telegram, native Share, Copy message and Copy link remain intact.
Existing URL encoding, popup isolation, supported-native-share detection,
clipboard fallback and truthful share-method evidence are preserved. Copy link
contains only the controlled secure URL. No tracking parameter was added.
Two-family/two-business/two-customer channel isolation and edited-message tests
pass. No messages were sent to actual customers during verification.

## H. Security and unchanged behavior

Token entropy/generation, SHA-256 hashing and hash-only persistence, purpose,
expiry, used-link policy, regeneration, revocation, submissions, tenant/RLS rules,
customer-view behavior, public customer UI, custom email, providers, lifecycle,
notifications and scheduler remain unchanged. No schema or storage policy change.
Existing Sharp logo limits remain ≤200 KiB, ≤512px, single WebP, canonical owned
path, four-second fetch timeout, no redirects, contained output and transparent-
pixel-only trimming. No private bucket is exposed or signed URL introduced.

## I. Alignment

**SECURE SOCIAL PREVIEW ALIGNMENT GATE: PASS**

Both actual PNGs were visually inspected at 1200×630, 600×315 and 300×158. Vendor
identity, bold action heading and platform attribution remain recognizable at
thumbnail scale. The white card, green outline, pale-green illustration, lock,
divider and secondary attribution follow the approved reference. Seven logo
shapes, initials, failed-logo fallback, 160-character spaced and unbroken names
were rendered; long names are clamped/ellipsized without overlap. Ordinary,
missing-logo and long-name samples were inspected. No social-app chrome is baked
into the image. Official platform artwork is unmodified; local licensed Inter
400/700 TTFs match the existing product typeface and appear in build traces.

## J. Validation

| Check | Final result |
| --- | --- |
| `npm run lint` | Exit 0; 0 errors, 4 pre-existing warnings in ignored diagnostic scripts |
| `npm run typecheck` | Exit 0 |
| `npm test` | **1,039 passed, 0 failed, 24 skipped**; 166 passed files, 21 skipped files |
| `npm run test:security:runtime` | **0 passed, 0 failed, 21 skipped** (existing guarded live checks; subset of full-suite skips) |
| `npm run build` | Exit 0; optimized build and TypeScript passed |
| `npx playwright test --config playwright.profile-ui.config.ts` | **39 passed, 0 failed, 0 skipped** across Chromium/WebKit; includes 8 new secure-preview cases |
| `git diff --check` | Exit 0 |

The 24 full-suite skips comprise 21 guarded live runtime checks and 3 existing
opt-in preview generators. No skips were added or test protections weakened.
The new isolated crawler, image privacy/failure, tenant/state and public-route
checks execute normally. The broader browser run covers existing profile routes,
auth guards, notifications, all four capability families and nine email layouts.

The first browser pass caught standalone Telegram's streamed metadata; the
additive blocking-crawler fix passes the final run. Two full-suite failures were
stale assertions for the intentionally replaced share copy and were updated to
the exact new text. One interrupted browser-server startup timed out; subsequent
build and complete 39-test run passed. The full browser run emitted one Next
`destination stream closed early` message during an existing navigation check;
that test and the complete run passed. No physical messaging-client/cache result
or hosted preview/deployment is claimed.

Documentation updated in this task: README; MASTER_PLAN; PRODUCT_SPEC; PHASES;
DECISIONS (ADR-068); DESIGN_SYSTEM; architecture; security; TESTING; CHANGELOG;
RELEASE_CHECKLIST; RESPONSIVE_QA; VENDOR_TRUST_BRANDING supersession note; both
feature READMEs; this evidence document; Inter source/license notes. No data-model
or migration documentation change is needed because the schema is unchanged.

## K. Manual review / stop

The screenshots above are real PNG responses from the local optimized server,
using synthetic public business identity. More samples:

- [Confirmation without a logo](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-none-1200.png)
- [Feedback without a logo](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-none-1200.png)
- [Confirmation long name](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-long-name-1200.png)
- [Feedback long name](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-long-name-1200.png)
- [Generic confirmation](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-confirmation-generic.png)
- [Generic feedback](/Users/frankenstein/Desktop/MyKustomers/MyKustomers-main-app/output/playwright/secure-social-previews/chromium-feedback-generic.png)

The browser test servers stop automatically after verification. These image
artifacts remain available for review. Reproduce locally with the Playwright
command above. This task is **stopped for manual review**. Nothing from this
social-preview pass has been pushed, merged or deployed; the scheduler is untouched.
