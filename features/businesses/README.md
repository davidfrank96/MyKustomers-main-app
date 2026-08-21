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
