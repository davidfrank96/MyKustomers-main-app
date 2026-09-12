# Vendor Trust Branding — Social Links and Emails

STATUS: IMPLEMENTED — RELEASE VERIFICATION PENDING

## Scope and capability inventory

| Capability | Route | Starting branding | Implemented branding |
| --- | --- | --- | --- |
| Booking confirmation / reschedule confirmation | `/c/[token]` | Booking-owned PNG, 224px frame / 192px artwork | Same owner resolver, shared 304px frame / 280px artwork |
| Private customer feedback | `/f/[token]` | Generic platform social metadata | Exact feedback link → booking → business; vendor PNG |
| Booking amendment | `/a/[token]` | Generic platform social metadata | Exact amendment → booking → business; vendor PNG |
| Booking add-on | `/x/[token]` | Generic platform social metadata | Exact confirmation link → add-on + booking → business; vendor PNG |
| Public homepage/features/general URLs | Existing public routes | Platform branding | Platform branding retained |
| Auth callback/recovery, authenticated notification opens | Existing system routes | Platform or private authenticated context | No vendor social projection; these are not customer transaction capabilities |

Code search of native share, WhatsApp/Telegram, copy-link, email CTA and unauthenticated routes found no additional customer capability family. Rescheduling reuses `/c`; delivery feedback and manual feedback sharing reuse `/f`. No payment/receipt capability exists.

## Social rendering and privacy

`features/businesses/social-image.tsx` owns one 1200×630 composition. The 304px
rounded-square frame contains up to 280px of artwork, centered within the 630px
square crop. Text uses a centered 570px safe region, 46/40/32px bounded sizing and
at most three lines with an explicit ellipsis; full business identity remains in
metadata. Purpose labels are Booking confirmation, Customer feedback, Booking
update and Booking add-on. There is one authoritative image in both OG and X
metadata, with dimensions, PNG MIME and vendor alt text. Missing/failed logos
retain vendor initials.

`logo-projection.ts` accepts only canonical bounded WebP paths, downloads at most
200 KiB with a four-second timeout and no redirects/credentials, checks ≤512px
edges and rejects animation, and trims **only fully transparent pixels** before
containing the artwork in PNG. Opaque whitespace, antialiasing and artwork are
preserved; canonical Storage assets are never changed. No arbitrary image URL or
caller-provided business name is accepted at an image route.

Each family retains its own authoritative resolver. Feedback accepts both
existing token versions by hash; it reads no feedback content or Vault material.
Only delivered/completed parent bookings disclose feedback branding. Amendments
respect pending expiry, parent status and base-terms staleness; already confirmed
records keep neutral business identity. Add-ons validate the exact tenant/booking/
add-on tuple, purpose, revocation, expiry and confirmation state. Invalid,
revoked or unavailable records return generic metadata / image 404. Used-link
copy never states submission/decision history.

Image URLs reuse existing UUIDv4 records under `/social/{kind}/{previewId}`.
These identifiers disclose only public business identity and never authorize
customer reads or actions. All social image and capability responses retain
no-store, no-referrer and noindex/nofollow/noarchive/nosnippet/noimageindex.
Every image fetch rechecks capability state. External messaging caches are outside
application control; fresh controlled links are required for release verification.
Known crawler HTML and open attribution return without domain mutations or
rate-limit writes. Raw tokens/hashes/customer data remain absent from metadata,
images, alt text, sitemap, JSON-LD and diagnostic evidence.

## Shared transactional email identity

The old shared shell rendered a 42px initial and adjacent inline business name.
The new shell uses a fixed 52px vendor image (or a 52px initial) and an independent
wrapping text cell. The rounded-square PNG includes its own containment and
padding, so older clients do not need object-fit support. Name and meaningful alt
remain when remote images are blocked. Mobile spacing and long-name wrapping are
contained without changing subjects, CTA meaning or recipients.

All nine existing events are covered: confirmation requested, confirmed,
rescheduled, delivered (including the existing feedback CTA), cancelled,
amendment requested/confirmed and add-on requested/confirmed. There is no
standalone receipt/payment-recorded/feedback-request event. Recorded payment
information remains in the implemented add-on confirmation. Supabase Auth and
platform/system emails are outside the shared vendor shell and unchanged.

A bounded optional read selects `logo_path` by the **claimed event business_id**;
it cannot depend on cookies, membership ordering or browser state. Exact owned
path validation prevents cross-branding. Failure falls back to initials and
cannot block dispatch. Existing frozen business-name/contact evidence remains
intact. Provider selection, Brevo primary/Resend standby, recipient rules,
outbox claims, retries, webhook correlation and capability associations are
unchanged.

Email images use `https://mykustomers.com/brand/business/{businessId}/logo.png`:
no expiring signature, tracking query, customer identifier or capability token.
The route projects the current approved public logo as a 208×208 PNG (184px
artwork + 12px padding per edge). HTTP/CDN caching is bounded to one hour with
revalidation; no stale-while-revalidate or permanent duplicate asset is created.
Only public logo content is cached, and replacements/removals are reflected on
cache expiry. Missing assets return noncached 404. Recipient image proxies may
retain their own cached copy.

Format audit: [Can I email's firsthand WebP tests](https://www.caniemail.com/features/image-webp/)
show client/version gaps and partial conversion/browser-dependent support; its
[PNG tests](https://www.caniemail.com/features/image-png/) show broader support.
The test matrix includes older versions (WebP test date 2021), so it is evidence
for choosing conservative PNG, not a claim of current physical-client testing.

## Unchanged boundaries

Database/schema/migrations/RLS/RPCs: **NONE**. Environment: **NONE**.
DNS/providers/BIMI/sender avatar: **NONE**. Dependencies: **NONE**.
The notification scheduler remains active and is not modified.

Upload governance remains unchanged: PNG/JPEG/WebP ≤5 MiB source; client-prepared
transport ≤3 MiB / 2048px; server source ≤6000px edge /25M pixels; normalized
WebP ≤512px /200 KiB. One public `business-logos/{businessId}/logo.webp` asset,
owner-authorized upload/replacement/removal, no raw source retention. This pass
adds deterministic read-only projections only.

## Verification evidence

Focused unit tests cover all family ownership/privacy/state rules, original
confirmation behavior, bounded logo decoding, all nine templates with/without
logos, unsafe URL rejection, and real outbox rendering with a stubbed provider
for two businesses. Browser fixtures run a production Next build against isolated
loopback Auth/REST/Storage, with no real data or mail transport.

The browser matrix checks five representative crawler signatures, A/B identities,
invalid/expired/revoked/mismatched capabilities, UUID non-authority, no-logo and
failed-logo fallbacks, and zero writes. Social fixtures include square, circular,
wide 2:1, wide 3:1, tall, transparent, transparent-margin, no-logo and 160-character
names, at full size, 360×189 and central 240px square crops. Email checks render
all nine templates at 320/360/390/430/600/700 widths with normal, 50-character and
100-character names, image loaded/blocked, visible CTAs and no overflow.
Screenshots live in ignored `output/playwright/vendor-trust-branding/`.

Initial visual checks found a border-box size mismatch, a name clamp requiring
Satori's block display, and inherited long-name paragraph overflow. These were
fixed; no assertion was weakened. The blocked-image WebKit check uses a fresh
context to avoid a previously loaded image cache. Existing feedback security
contracts now read the extracted resolver, and existing cloud E2E expects the
new vendor metadata while retaining customer-privacy and lifecycle assertions.

Unit/integration suite: 1012 passed, 24 existing guarded skips at the current
checkpoint. Runtime Security: 21 guarded tests skipped (no live security claim).
Dependency audit: zero vulnerabilities. The complete local production-build browser suite passed all 31 tests in Chromium
and WebKit. Lint and diff checks pass. The full cloud-backed E2E run passed 67
and skipped 19, with two failures (old metadata expectations and a transient Auth
setup failure); both affected canonical journeys passed after correction/retry.
Typecheck also passes. CI and Production evidence will be recorded in the release report.

Physical WhatsApp Android/iOS, iMessage, Meta/Messenger and X app rendering remain
unverified. Metadata tests are explicitly separate. A fresh controlled Production
confirmation and feedback smoke and a minimal email to an explicitly approved
inbox are required before release verification is complete. No inbox was yet
supplied at this checkpoint.
