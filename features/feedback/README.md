# Feedback Feature

Phase 8 implements private customer feedback and internal operational booking
issues.

## Owns

- Feedback token generation, hashing, expiry, and validation helpers.
- Public feedback lookup and submission wrappers.
- Feedback link creation/recovery, revocation, and legacy replacement actions.
- Contextual trusted sharing through native share, WhatsApp, Telegram, copied
  message, and copied application-controlled link methods.
- Truthful share-intent and idempotent first-browser-open evidence.
- Booking issue create/resolve server actions.
- Tenant-scoped feedback and issue queries.
- Feedback and issue validation schemas.

## Data

Primary tables:

- `public.feedback_links`
- `public.feedback`
- `public.booking_issues`

Feedback links are scoped to `booking_feedback`, store only capability hashes,
expire after 14 days by default, and are separate from confirmation links.
Historical version 0 links use random SHA-256 capabilities. New version 1 links
are deterministically recoverable only by privileged database functions using a
Vault-backed HMAC secret, allowing delivery and manual sharing to return the
same raw capability without storing it. The nullable `first_opened_at` timestamp and `FEEDBACK_OPENED` audit event
are written once by a service-only RPC. `FEEDBACK_SHARE_INITIATED` records the
selected sharing method after tenant authorization, not provider delivery or a
customer read. Feedback can be submitted only for delivered or completed
bookings without existing feedback. Submission automatically completes a
delivered booking when authoritative outstanding payment is already zero;
otherwise final payment may complete it later.

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

Metadata lookup selects only link validity and approved public business identity.
Known preview crawlers receive a generic shell before private booking lookup and
cannot trigger open evidence. An ordinary browser records open evidence after
the page loads. All `/f` responses remain non-cacheable and external redirect
targets are not accepted.

On vendor booking detail, feedback is projected as the final journey step from
`DELIVERED`: no link means Request feedback, an active link means Share
feedback request, and submitted feedback closes the journey as Feedback
received. This is presentation only; feedback does not add or alter a booking
status.
