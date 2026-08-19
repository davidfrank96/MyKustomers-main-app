# Confirmation Links Feature

Phase 6 implements secure customer confirmation links for bookings.

## Owns

- Opaque token generation and SHA-256 hashing.
- Vendor server actions for generating, regenerating, and revoking links.
- Server-only public lookup and confirmation helpers for `/c/[token]`.
- Persistent public endpoint rate limiting.
- Material-change classification for confirmation invalidation tests.
- Safe public status messages.

## Security Rules

- Raw tokens are generated with 32 bytes of cryptographic randomness and encoded
  as base64url.
- Only `token_hash` is stored in `public.confirmation_links`; raw tokens are
  shown once after generation.
- Booking references, booking IDs, and customer IDs are not public
  authorization credentials.
- Public GET lookup does not consume a link.
- Customer confirmation is POST-backed and atomic in the database.
- Expired, revoked, consumed, unknown, and invalid tokens return safe public
  statuses.
- Public views must not include internal notes, audit logs, business members,
  token hashes, tenant IDs, or service-role-only data.
- Material booking-term changes after confirmation require a fresh customer
  confirmation. Internal notes are non-material.
- Vendor UI copy should describe customer links without exposing token internals
  in visible product language.

## Data

Primary tables:

- `public.confirmation_links`
- `public.booking_confirmations`
- `public.confirmation_rate_limits`

Primary RPCs:

- `public.create_booking_confirmation_link`
- `public.revoke_booking_confirmation_link`
- `public.get_confirmation_public_view`
- `public.confirm_booking_by_token_hash`
- `public.consume_confirmation_rate_limit`

Vendor generate/revoke RPCs are granted to `authenticated`. Public lookup,
confirmation, and rate-limit RPCs are server-only service-role calls.

See `docs/security.md`, `docs/DATA_MODEL.md`, and `docs/DECISIONS.md` for the
accepted Phase 6 security and architecture decisions.
