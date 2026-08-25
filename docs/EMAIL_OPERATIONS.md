# Email Operations

Status: VERIFIED - PRODUCTION

`/admin/emails` is the platform administrator's read-only view of the existing
My Customers transactional email outbox. It does not create a second delivery
architecture and it does not expose customer communications.

## Authoritative Semantics

Persisted states are `PENDING`, `SENDING`, `SENT`, and `FAILED`. `SENT` means the
configured adapter or provider accepted the request. My Customers does not
currently receive authoritative delivery, bounce, open, or read evidence, so
those terms are not used as statuses.

The six implemented event types are `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`,
`BOOKING_AMENDMENT_REQUESTED`, `BOOKING_AMENDMENT_CONFIRMED`,
`BOOKING_ADDON_REQUESTED`, and `BOOKING_ADDON_CONFIRMED`.

## Read Contract

The default view is the last seven days, with Today and last-30-day presets.
Search is limited to 80 characters and matches booking reference, business name,
or event type literally. Status, event type, business, and booking filters
compose server-side. Pages contain 20 records and use `created_at DESC, id DESC`
for stable newest-first ordering.

Directory responses contain event ID/type/status, safe business and booking
identity, attempt count, and timestamps. They contain no recipient or failure
fields. Detail may add only the existing masked recipient and one controlled
failure category: invalid recipient, rate limited, configuration error, provider
rejected, temporary provider failure, or unknown failure.

Neither response contains message HTML/text, provider message IDs, provider
requests/responses, raw failure code/message, customer contact evidence, tokens,
capability URLs, credentials, or service secrets. Unexpected fields fail strict
DTO parsing.

## Health And Delivery Reality

`Attention` means failed events exist in the selected context. `Backlog` means
no failed event exists but at least one pending or sending event is older than
15 minutes. `Healthy` means neither condition exists. Fifteen minutes is
conservative for the current synchronous post-commit delivery path, which should
normally resolve in seconds and has no worker/retry scheduler.

Production-safe read evidence on 2026-08-25 found eight events: seven `SENT`
records accepted by the no-network development adapter and one `PENDING` record
older than 15 minutes. Current delivery reality is therefore `OUTBOX ACTIVE -
EXTERNAL DELIVERY NOT CONFIGURED`. This is not a provider-delivery claim.

After deployment, authenticated production smoke found nine existing events:
eight `SENT`, one `PENDING`, zero `SENDING`, and zero `FAILED`. The additional
event was existing live application activity, not a verification fixture. The
same backlog and delivery-configuration semantics rendered truthfully.

## Security And Deferred Writes

The server requires platform-admin authorization before invoking either narrow
RPC. Each RPC independently asserts an active `SUPER_ADMIN`, uses an empty search
path, is postgres-owned, and grants execute only to `authenticated` after PUBLIC
and anonymous revocation. No direct `email_events` table grant is added. Reads
are platform-wide, current-business independent, non-mutating, and not audited.

Retry/resend could communicate externally and mutate durable outbox state. It is
deferred to Admin Phase 6 until MFA, privileged write authorization, idempotency,
reason capture, atomic audit semantics, and notification side effects receive a
separate review. No Phase 6 work is part of this implementation.

## Verification Evidence

The approved migration applied transactionally to the configured
production-backed project. Before and after counts remained eight email events
and one active `SUPER_ADMIN`. Function ownership/search paths and grants match
the reviewed migration. Anonymous, ordinary, and disabled callers are denied;
the controlled active admin read succeeds; status/type/punctuation filters and
strict minimized outputs pass; and outbox delivery fields are byte-equivalent
before and after reads. Full Playwright passes with 35 tests and 7 intentional
skips. Temporary Auth/admin cleanup returned to zero leftovers.

PR #19 passed all required checks and merged as `52a1820`. Vercel deployed the
exact merge commit and all duplicate `main` push checks completed successfully,
apart from the intentional safe-target Runtime Security skip. The existing
approved production admin session then verified the live summary, directory,
detail, search, status and event-type filters, pagination, recipient masking,
business/booking cross-links, absence of write controls, and desktop layout.
The smoke created no email or domain record and did not change outbox state.
Two controlled temporary Auth creation attempts returned HTTP 500 before an
Auth UUID was issued; the residue check found zero matching users or authority
rows and exactly one approved active `SUPER_ADMIN`.
