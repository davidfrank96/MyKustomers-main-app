# Feedback Feature

Phase 8 implements private customer feedback and internal operational booking
issues.

## Owns

- Feedback token generation, hashing, expiry, and validation helpers.
- Public feedback lookup and submission wrappers.
- Feedback link generation, revocation, and regeneration server actions.
- Booking issue create/resolve server actions.
- Tenant-scoped feedback and issue queries.
- Feedback and issue validation schemas.

## Data

Primary tables:

- `public.feedback_links`
- `public.feedback`
- `public.booking_issues`

Feedback links are scoped to `booking_feedback`, store only SHA-256 token
hashes, expire after 14 days by default, and are separate from confirmation
links. Feedback can be submitted only for completed bookings without existing
feedback.

Feedback is private, immutable after submission, and visible only to active
members of the owning business. Operational issues are internal tenant records,
not public customer-visible support tickets.

## Public Boundary

The public `/f/[token]` route uses server-only lookup/submission calls,
persistent hashed rate limiting, no-store/noindex/no-referrer headers, and
minimized booking context. Public pages do not expose internal notes, balances,
audit data, tenant IDs, token hashes, feedback comments from other states, or
booking issues. Unavailable public states should give customers a safe next
step, such as contacting the business for a fresh link.
