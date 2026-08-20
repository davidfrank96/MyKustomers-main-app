# Email

Booking-confirmed transactional email is implemented through a server-only,
provider-neutral boundary.

`public.email_events` is the durable outbox. Confirmation creates one event in
the same database transaction as booking state, contact evidence, customer
enrichment, link consumption, and audit linkage. `deliverEmailEvent` claims the
event atomically and sends only after commit. Provider failure records `FAILED`
without changing the confirmed booking.

The default `development` provider performs no external request and returns a
synthetic message ID. Real delivery requires
`TRANSACTIONAL_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and
`TRANSACTIONAL_EMAIL_FROM` in server-only configuration.

Only `BOOKING_CONFIRMED` exists now. PDF attachments, retries/scheduling,
bounce handling, and ready/progress/completion/feedback emails are deferred.
