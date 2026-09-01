# Businesses Feature

Phase 2 implements the initial business tenancy model and membership foundation.
Phase 3 implements business onboarding, profile fields, contact details, owner
membership creation, and owner-editable profile settings. Cross-phase business
identity adds an optional normalized HTTP/HTTPS website and one current logo.

Tenant authorization is based on `business_members`, not a permanent single
`business_id` on the user profile.

Business creation goes through the `create_business_onboarding` Supabase RPC so
the business row and owner membership are created atomically. The RPC derives
ownership from `auth.uid()` and does not trust a client-submitted owner ID.

Users may select a PNG/JPEG/WebP logo source up to 5 MiB. Sources above the
3 MiB transport boundary are decoded in the browser, checked against the
6000px-per-edge/25-megapixel product policy, stripped of metadata by canvas,
and reduced to a 2048px-or-smaller JPEG/WebP intermediate before transmission.
This exists because Vercel Functions reject raw requests around 4.5 MB and
multipart overhead makes a near-limit target unsafe. The intermediate is never
persisted.

Client preprocessing is a transport optimization only. The authenticated route
independently enforces a 3 MiB received-file boundary, validates the received
content rather than trusting MIME, extension, or client dimensions, decodes it
with Sharp, strips metadata, preserves aspect ratio, and persists WebP no larger
than 512px/200 KiB at `{business_id}/logo.webp`. Only active owners can
list/write/delete through Storage RLS. Replacement overwrites the deterministic
object; removal clears `logo_path` before cleanup and falls back to business
initials. No original is stored.

Onboarding and Business settings both render the shared `BusinessLogoForm` and
use `prepareBusinessLogoForUpload` before posting multipart data to
`/api/businesses/{business_id}/logo`. They therefore share the same preparation,
authorization, validation, Sharp conversion, Storage, database-reference,
audit, and revalidation boundary. Requests have a Nigeria-mobile-tolerant
120-second network bound and a separate 30-second preparation bound; timeout,
network failure, invalid server response, and validation errors restore controls
and preserve a retryable selected file without staging another business.
Successful upload/replacement uses a fresh query version for the current browser
identity so a deterministic public object URL cannot display the prior CDN copy
immediately after upsert; the underlying Storage path remains stable.

Permanent invariant: "Every business-logo creation, replacement, or onboarding
upload must use the same validated, authorized, metadata-stripping, bounded
compression pipeline before persistence."

Permanent transport invariant: "Client-side business-logo preprocessing is a
transport optimization only. Server-side image decoding, validation,
normalization, compression, authorization, and persisted-size enforcement
remain authoritative."

Permanent pending-state invariant: "Image upload UI must terminate into success
or a recoverable error state. It must never remain indefinitely pending after
request failure or timeout."

Customers, bookings, confirmations, feedback, and insights remain in their own
feature modules. Staff invitations, galleries, additional social networks,
subscription billing, customer payment processing, and external messaging
integrations remain outside this pass.

Accounts can create another business at `/business/new` and switch from the
shared authenticated header. The returned onboarding business becomes current.
The current ID is remembered in an HTTP-only cookie but is resolved against
active memberships on every dashboard request. Missing, forged, or revoked
values fall back safely; membership-specific role controls remain effective.
The switcher is not a sixth mobile navigation destination.

The authenticated Business page is the discoverable membership surface. `My
businesses` displays the bounded active-business list already resolved for the
current user, each owner/member role, and a textual current state. Non-current
rows submit to the same `switchCurrentBusinessAction` as the header, and the
existing `/business/new` route remains the only additional-business flow. No
business UUID is shown as user-facing content, and the submitted ID remains
untrusted until the server repeats active-membership validation.

Google authentication enters this same resolution path; no provider-specific
tenant logic exists. Runtime provider activation verified zero-membership
onboarding, one-business routing, multi-business current-workspace resolution,
switching, refresh persistence, and logout through a real Google-authenticated
local session. The merged production deployment repeated the callback,
multi-business resolution, switching, persistence, and logout journey.

## Membership State Matrix

- Zero active memberships: vendor routes and vendor server actions resolve to
  `/onboarding`; the onboarding page has no vendor shell.
- First-business setup pending: the durable business/membership is retained, the
  existing logo step resumes, and normal workspace selection remains blocked.
- One active completed membership: that business is selected deterministically.
- Multiple active completed memberships: a validated current-business cookie is
  honored; a missing, forged, or revoked value falls back to the first permitted
  business.
- Last active membership revoked: the next request or server action loses vendor
  access immediately and returns to onboarding; no persistent membership cache
  delays revocation.

`business_members` is the tenant-access authority. Profile rows, auth metadata,
cookies, URL parameters, browser state, and the fact that a user previously had
a workspace are never membership substitutes. `/business/new` is an additional-
business flow only; it is not the primary zero-business gate.

Every newly created business must complete a valid optimized business-logo
upload before setup is considered complete. First and additional creation
require a logo selection before the atomic creation RPC. The returned business
uses the existing onboarding-completion field to persist a pending state and is
excluded from normal current-business resolution/switching. A short-lived
HTTP-only marker preserves the same-browser route while the shared logo component
posts to the existing owner-authorized route. Only a server re-read of
`logo_path` completes setup, updates the completion timestamp, and selects the
business. Invalid or storage failures remain resumable across refresh and reuse
the same business. No raw file enters the RPC and no schema change is required.

Existing legacy businesses without logos remain usable and keep initials
fallback plus Business-page upload, replace, and remove. Removal is therefore a
known legacy-policy inconsistency with the new-creation invariant; changing
active businesses to replacement-only requires a separate product decision.
