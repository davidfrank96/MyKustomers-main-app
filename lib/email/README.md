# Email

Supabase Auth email and My Kustomers transactional email are separate systems.
Supabase Auth owns signup confirmation and password-recovery delivery. The
application never stores or sends Auth passwords or recovery tokens.

Booking-confirmed, confirmed-booking-cancelled, amendment-requested,
amendment-confirmed, add-on-requested, and add-on-confirmed transactional email
are implemented through one server-only, provider-neutral boundary.

All implemented booking lifecycle templates use one structured, email-safe HTML
shell with a 600px container, conservative inline styles, mobile stacking,
plain-text equivalents, escaped customer-facing values, and restrained dark-mode
overrides. The shell presents My Kustomers and business identity consistently.
Current template inputs do not include an approved public business-logo URL, so
the identity block uses a business-name initial without adding storage reads.
Subjects, recipients, idempotency, delivery state, and provider selection remain
outside the presentation helper.

Every supported customer lifecycle message includes a restrained platform
attribution in both HTML and plain text. The link resolves only to the verified
canonical `https://mykustomers.com` origin; local, loopback, and Vercel preview
origins are never emitted into customer email.

`public.email_events` is the durable outbox. Confirmation creates one event in
the same database transaction as booking state, contact evidence, customer
enrichment, link consumption, and audit linkage. `deliverEmailEvent` claims the
event atomically and sends only after commit. Provider failure records `FAILED`
without changing the confirmed booking.

Confirmed cancellation creates one `BOOKING_CANCELLED` event in the same
transaction as status, reason, history, link revocation, and audit state. The
immutable booking confirmation contact is authoritative; current customer email
is only a fallback for legacy confirmation evidence without contact. Delivery
uses the preserved confirmation snapshot plus cancellation reason/time.
Provider failure marks the event `FAILED` and never rolls back `CANCELLED`.

Amendment proposal atomically creates `BOOKING_AMENDMENT_REQUESTED` using the
frozen latest confirmation contact. The raw purpose-specific link is passed to
delivery only in memory and is never persisted; if request delivery fails, the
pending amendment remains valid and the vendor can manually share the one-time
link or revoke/replace the request. Customer approval atomically creates one
`BOOKING_AMENDMENT_CONFIRMED` event from durable old/proposed evidence. Provider
failure never rolls back approved booking terms. Cancellation rendering uses the
latest confirmed amendment effective snapshot when present.

Add-on submission atomically creates `BOOKING_ADDON_REQUESTED` using the frozen
confirmation contact. The request message contains the secure link, business,
and booking reference but omits add-on title and amounts. Customer approval
atomically creates one `BOOKING_ADDON_CONFIRMED` event. Its message includes the
confirmed add-on and current booking/add-on totals while stating that deposits
are recorded information and My Customers did not process payment. Delivery
failure never changes add-on state.

The default `development` provider performs no external request and returns a
synthetic message ID. Brevo delivery requires
`TRANSACTIONAL_EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and
`TRANSACTIONAL_EMAIL_FROM`; Resend remains supported with its existing key. All
external configuration is server-only.

`BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_AMENDMENT_REQUESTED`,
`BOOKING_AMENDMENT_CONFIRMED`, `BOOKING_ADDON_REQUESTED`,
`BOOKING_ADDON_CONFIRMED`, `BOOKING_RESCHEDULED`, and `BOOKING_DELIVERED`
exist now. PDF attachments,
automatic retries/scheduling, bounce handling, and
ready/progress/completion/feedback emails are deferred.

There is no standalone payment-recorded or feedback-request email event. The
existing add-on-confirmed message is the only implemented payment-related
customer update and describes amounts as recorded information, not verified
transactions. Private feedback continues to use trusted manual sharing; no email
template or outbox path is manufactured solely for presentation parity.

Confirmed reschedules atomically create a replacement confirmation link and a
`BOOKING_RESCHEDULED` event tied to the exact change/link evidence. Delivery
transitions atomically create `BOOKING_DELIVERED` from immutable confirmation
contact evidence. Booking messages share a stable subject family and opaque
correlation headers. Standard RFC thread headers are not manufactured because
Brevo does not support them and no authoritative RFC message ID is persisted.
The reschedule request cannot be retried through Phase 6B because its raw secure
token exists only for the original in-memory delivery.

Admin Phase 5 observes this existing outbox through narrow read-only RPCs. Its
default window is seven days; Today and 30-day presets are also available.
`SENT` is presented as adapter/provider acceptance and never as delivered,
opened, or read. Pending or sending events are called potentially stuck only
after 15 minutes because delivery is invoked immediately after commit and there
is currently no retry worker or scheduler. Directory rows omit recipients and
failures; detail exposes only a masked recipient and controlled failure category.
Message bodies, provider IDs, raw provider/failure payloads, and credentials are
never returned.

Admin Phase 6B adds manual retry on event detail only. A centralized policy
classifies a matching latest failed attempt as retryable, ambiguous, or
non-retryable. Only proven transient non-acceptance can pass. The AAL2 server
action requires an active `SUPER_ADMIN` and bounded reason, then atomically
appends an attempt on the same event through the original provider. Prior
attempts remain immutable evidence. There is no retry for ambiguous outcomes,
automatic schedule, provider failover, bulk/force resend, or domain mutation.

Provider modules in `lib/email/providers` use bounded HTTP timeouts and return
only a safe provider message ID or bounded failure. See
`docs/TRANSACTIONAL_EMAIL.md` for activation, sender authentication, privacy,
historical-event, and deferred webhook/retry rules.
