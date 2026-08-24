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

Logo source policy is PNG/JPEG/WebP, 2 MB, 6000px per edge, and 25 megapixels.
The authenticated route validates decoded content, strips source metadata,
preserves aspect ratio, and persists WebP no larger than 512px/200 KB at
`{business_id}/logo.webp`. Only active owners can list/write/delete through
Storage RLS. Replacement overwrites the deterministic object; removal clears
`logo_path` before cleanup and falls back to business initials. No original is
stored.

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
