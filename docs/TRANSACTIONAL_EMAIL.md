# Transactional Email

Status: IMPLEMENTED - CONFIGURATION REQUIRED

My Customers uses its own durable transactional outbox. Supabase Auth email is
a separate system. Business-domain workflows must never call an email vendor
directly. They create durable email events; provider adapters own external
delivery.

## Provider Boundary

`TRANSACTIONAL_EMAIL_PROVIDER` selects one server-only adapter:

- `development`: default no-network adapter with a synthetic provider ID.
- `brevo`: approved Production adapter using Brevo's direct transactional API.
- `resend`: retained external adapter and rollback option.

The selected external provider fails closed if its key or sender is missing or
invalid. It never silently falls back to another external provider. Brevo and
Resend requests have bounded timeouts; 401/403, 429, other 4xx, 5xx, network,
timeout, and malformed-success responses map to safe internal failures. Raw
provider failure payloads are neither parsed nor exposed.

The outbox claim is the authoritative concurrency boundary. The Brevo adapter
also derives a deterministic UUID from the event idempotency key for the
provider's idempotency field. Provider failure marks only the email event
according to the existing failure path. External provider failure must never
reverse an already committed booking/customer domain transaction.

## Configuration

Environment variable names are:

```text
TRANSACTIONAL_EMAIL_PROVIDER
TRANSACTIONAL_EMAIL_FROM
BREVO_API_KEY
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
dedicated-IP setup. Activation cannot be called verified until the account,
sender identity, domain status, and a controlled operator inbox are available.
Reply-To remains unset because the product has no reviewed tenant-safe model.

## Data And Semantics

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
durable operational evidence. Brevo supports delivery and bounce webhooks, but
secure ingestion, delivered/bounce state semantics, scheduled retries, quota
telemetry, MFA, and Admin Retry are deferred to a separate authorized phase.

## Verification

Unit/integration tests cover all provider selections, no-network delivery,
Brevo and Resend request contracts, provider success IDs, safe HTTP/network/
timeout failures, malformed responses, sender validation, and Admin wording.
Static security tests cover server-only credentials, direct per-message sending,
domain neutrality, atomic claim preservation, no domain rollback path, no
logging, no marketing/contact APIs, and retained adapters. Real provider and
inbox evidence must be recorded only after controlled Production activation.
