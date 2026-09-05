# Transactional Email

## Provider Delivery Evidence

IMPLEMENTED — VERIFICATION PENDING. Future Brevo sends include
`X-Mailin-custom: mk-attempt-v1:<opaque digest>` derived from the exact random
delivery-attempt UUID. It contains no customer, booking, capability, or recipient
data. `POST /api/webhooks/brevo/transactional` authenticates a dedicated bearer
secret before parsing, enforces JSON and a 32 KiB streaming body limit, maps only
approved delivery/suppression events, and invokes one service-role-only ingestion
RPC. Raw callbacks and arbitrary provider reasons are never persisted.

Provider events are append-only and idempotent. Current state uses explicit sticky
priority plus provider timestamps, not HTTP receipt order. `SENT` remains provider
acceptance and never means destination delivery, inbox placement, opening, or
customer acknowledgement. Permanent failures/complaints never trigger automatic
retry or Resend failover; manual secure-link sharing remains available.

Status: VERIFIED - PRODUCTION

My Kustomers uses its own durable transactional outbox. Supabase Auth email is
a separate system. Business-domain workflows must never call an email vendor
directly. They create durable email events; provider adapters own external
delivery.

## Provider Boundary

`TRANSACTIONAL_EMAIL_PROVIDER` selects one server-only adapter:

- `development`: default no-network adapter with a synthetic provider ID.
- `brevo`: approved Production adapter using Brevo's direct transactional API.
- `resend`: verified standby adapter selected only by an explicit configuration change.

The selected external provider fails closed if its key or sender is missing or
invalid. It never silently falls back to another external provider. Brevo and
Resend requests have bounded timeouts; 401/403, 429, other 4xx, 5xx, network,
timeout, and malformed-success responses map to safe internal failures. Raw
provider failure payloads are neither parsed nor exposed.

The outbox claim is the authoritative concurrency boundary. Every new delivery
claim appends provider-pinned attempt evidence. The Brevo adapter derives a
deterministic UUID from the attempt-scoped event idempotency key for the
provider's idempotency field. Provider failure marks only the email event
according to the existing failure path. External provider failure must never
reverse an already committed booking/customer domain transaction.

## Configuration

Environment variable names are:

```text
TRANSACTIONAL_EMAIL_PROVIDER
TRANSACTIONAL_EMAIL_FROM
BREVO_API_KEY
BREVO_WEBHOOK_SECRET
RESEND_API_KEY
```

Keys are server-only and must never use a `NEXT_PUBLIC_` prefix. Production Brevo
activation requires `TRANSACTIONAL_EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and a
verified `TRANSACTIONAL_EMAIL_FROM` in Vercel Production only. Preview and local
development stay on `development` unless separately reviewed and intentionally
configured. No secret values belong in Git, documentation, terminal output,
screenshots, browser bundles, or logs.

Use a professional transactional sender. Brevo sender/domain authentication must
use the exact Brevo-supplied Brevo code, DKIM, and DMARC records. SPF is not added
unless Brevo supplies it for the actual account configuration, such as a
dedicated-IP setup. The account, sender identity, root domain, and Production-only
Vercel configuration are active. Activation cannot be called verified until a
newly deployed controlled event is accepted and the operator inbox is checked;
that controlled production verification passed on 2026-08-25.
Reply-To remains unset because the product has no reviewed tenant-safe model.

## Data And Semantics

Customer-contact validation is provider-neutral. The application trims the
address, preserves the mailbox/local part, lowercases only the domain, and then
applies supported email syntax validation. Gmail, Outlook/Hotmail, Yahoo,
iCloud, `.ie`, `.co.uk`, and custom domains are not allowlisted or treated
differently. Syntax acceptance is not provider acceptance, inbox delivery, or
mailbox ownership verification.

`BOOKING_CONFIRMATION_REQUESTED` is created only by the explicit Send
confirmation transaction. It references the exact fresh `confirmation_link_id`;
the plaintext token is used only in memory for the outbound `/c/` URL. Manual
Generate/share creates no email event. Recipient correction atomically revokes
the prior open capability and creates a new link/event. A same-recipient request
within 30 seconds creates and sends nothing. Provider failure leaves the booking
and committed request intact; because the token is unreconstructable, a fresh
vendor request—not generic admin retry—is the safe recovery path.

Brevo receives one direct recipient plus the existing subject, HTML, and
plain-text content. It does not receive a customer-directory synchronization,
contact creation, lists, campaigns, newsletters, or marketing automation.
Transactional providers receive only the minimum message and recipient
information necessary to deliver the specific email.

Persisted `SENT` means the configured provider accepted the request. It does not
prove delivery, inbox placement, opening, or reading. Only the provider message
ID, status, attempt/timestamp evidence, and bounded failure information are
stored. Admin Email Operations continues to mask recipients and excludes bodies,
provider IDs, raw failures, and credentials.

## Activation And Operations

Production activation is deliberately ordered: verify implementation and tests;
verify Brevo account and sender/domain; set Production-only Vercel values;
deploy reviewed `main`; then create one new controlled event, verify its single
claim, Brevo acceptance, stored provider evidence, controlled inbox receipt, and
truthful Admin Email Operations state. Historical events are never replayed as
part of provider activation.

The existing historical pending event is a `BOOKING_CONFIRMED` record with zero
attempts and no provider ID. At inspection it was about 46 hours old and its
recipient used the reserved `example.com` domain. It remains untouched and is
not activation input.

Feedback sharing currently creates no email event, so this phase adds no feedback
email. There is no automatic retry worker or scheduler; failed events remain
durable operational evidence. Phase 6B permits a manual AAL2 retry only for a
proven retryable non-acceptance class. It preserves the logical event and prior
attempts, pins the original provider, and denies ambiguous outcomes. Brevo
supports delivery and bounce webhooks, but secure ingestion, delivered/bounce
state semantics, scheduled/automatic retries, quota telemetry, force/bulk retry,
and provider failover remain deferred.

## Reschedule, Delivery, And Booking Grouping

A previously customer-confirmed reschedule creates the replacement confirmation
link and one `BOOKING_RESCHEDULED` event in the same transaction as the booking
change. The event references the exact change and link; the raw token is passed
to the provider boundary only in memory. Initial scheduling without prior
immutable confirmation does not send. A `DELIVERED` transition creates one
`BOOKING_DELIVERED` event from the immutable booking-confirmation recipient.
When that evidence is absent, delivery still creates the private version 1
feedback capability but creates no email event. It never resolves a recipient
from `customers.email`. Provider failure changes only outbox state.

Every booking message gets a stable booking subject and opaque custom thread and
message correlation headers. This is best-effort grouping only. Brevo's API does
not accept standard email headers, and the current provider evidence does not
store a verified RFC message identifier, so `Message-ID`, `In-Reply-To`, and
`References` are not guessed. Brevo remains primary, Resend remains standby,
and there is no failover or double-send.

## Verification

Unit/integration tests cover all provider selections, no-network delivery,
Brevo and Resend request contracts, provider success IDs, safe HTTP/network/
timeout failures, malformed responses, sender validation, and Admin wording.
Static security tests cover server-only credentials, direct per-message sending,
domain neutrality, atomic claim preservation, no domain rollback path, no
logging, no marketing/contact APIs, and retained adapters. Real provider and
inbox evidence was recorded only after the reviewed code deployed from `main`:
one `BOOKING_CONFIRMED` event was claimed once, accepted with a provider ID,
shown in Admin Email Operations, delivered by Brevo, and received in the
controlled inbox. Its temporary Auth, business, customer, booking, and email
fixtures were then removed with zero leftovers. Resend readiness does not enable
double-send or automatic failover.
