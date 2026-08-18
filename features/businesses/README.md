# Businesses Feature

Phase 2 implements the initial business tenancy model and membership foundation.
Phase 3 implements business onboarding, profile fields, contact details, owner
membership creation, and owner-editable profile settings.

Tenant authorization is based on `business_members`, not a permanent single
`business_id` on the user profile.

Business creation goes through the `create_business_onboarding` Supabase RPC so
the business row and owner membership are created atomically. The RPC derives
ownership from `auth.uid()` and does not trust a client-submitted owner ID.

Logo upload, staff invitations, customers, bookings, payments, and external
messaging integrations remain out of scope for this feature module until their
own phases.
