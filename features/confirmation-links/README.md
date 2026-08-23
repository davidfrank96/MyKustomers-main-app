# Confirmation Links Feature

Phase 6 implements secure customer confirmation links for bookings.

## Owns

- Opaque token generation and SHA-256 hashing.
- Vendor server actions for generating, regenerating, and revoking links.
- Server-only public lookup and confirmation helpers for `/c/[token]`.
- Required customer-provided email and optional phone validation.
- Immutable confirmation contact evidence and atomic booking-confirmed event
  creation.
- Persistent public endpoint rate limiting.
- Material-change classification for confirmation invalidation tests.
- Safe public status messages.
- Safe public business identity presentation for current logo/fallback,
  normalized website, and the existing Instagram handle.
- Contextual sharing utilities/UI, privacy-safe dynamic metadata, authenticated
  share-method audits, and idempotent hydrated first-open evidence.

## Security Rules

- Raw tokens are generated with 32 bytes of cryptographic randomness and encoded
  as base64url.
- Only `token_hash` is stored in `public.confirmation_links`; raw tokens are
  shown once after generation.
- Booking references, booking IDs, and customer IDs are not public
  authorization credentials.
- Public GET lookup does not consume a link.
- Customer confirmation is POST-backed and atomic in the database.
- Existing different customer email/phone values are never silently replaced;
  only empty fields are enriched.
- External email delivery happens after commit and cannot revert confirmation.
- Expired, revoked, consumed, unknown, and invalid tokens return safe public
  statuses.
- Public views must not include internal notes, audit logs, business members,
  token hashes, tenant IDs, or service-role-only data.
- Website and Instagram links are revalidated at render time, use only HTTP(S),
  open with `noopener noreferrer`, and remain secondary to confirmation.
- Branding fields are live public identity and are not added to immutable
  booking terms, so logo/website changes do not invalidate confirmation.
- Material booking-term changes after confirmation require a fresh customer
  confirmation. Internal notes are non-material.
- Vendor UI copy should describe customer links without exposing token internals
  in visible product language.
- Editable share text never controls the generated URL. Share events mean method
  selected, not delivered/read, and Open Graph metadata receives no customer or
  private booking fields.

## Data

Primary tables:

- `public.confirmation_links`
- `public.booking_confirmations`
- `public.confirmation_rate_limits`
- `public.email_events`

Primary RPCs:

- `public.create_booking_confirmation_link`
- `public.revoke_booking_confirmation_link`
- `public.get_confirmation_public_view`
- `public.confirm_booking_by_token_hash`
- `public.consume_confirmation_rate_limit`
- `public.record_confirmation_link_open`

Vendor generate/revoke RPCs are granted to `authenticated`. Public lookup,
confirmation, and rate-limit RPCs are server-only service-role calls.

See `docs/security.md`, `docs/DATA_MODEL.md`, and `docs/DECISIONS.md` for the
accepted Phase 6 security and architecture decisions.
