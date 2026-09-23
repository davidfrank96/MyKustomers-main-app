# WhatsApp booking updates — Phase 2

STATUS: IMPLEMENTED — VERIFICATION PENDING (2026-09-23).

This is an opt-in, single-business pilot. It is not a general rollout. The app
migration, production settings and real booking-message smoke remain unapplied.
The selected business UUID is held only in private runtime configuration. There
are no live gateway credentials or controlled recipient numbers in this repository.

## Architecture and contracts

Booking domain transactions keep their existing validation, locking, status,
confirmation and audit behavior. Only the existing customer email intent inserts
fan out through `private.enqueue_booking_communication`. No provider call occurs
inside a booking transaction. An absent preference preserves the existing Email
behavior. Both creates one intent per channel; WhatsApp-only suppresses that
booking's customer email intents without relaxing customer-contact requirements.
Email templates, Brevo primary / Resend standby and email delivery evidence are
unchanged. The authenticated channel wrappers pass the exact existing capability
into the same transaction; they do not issue a second link.

`lib/whatsapp` exposes a server-only provider contract (`sendText`, `health`) and
one WA-AKG adapter. Unknown providers fail closed. No Meta implementation exists.
Nine existing events are supported: confirmation requested, confirmed,
rescheduled, cancelled, delivered/feedback, amendment requested/confirmed and
add-on requested/confirmed. Plain-text templates include business identity,
booking reference, the relevant existing secure link, and “Powered by My Kustomers”.
They exclude private notes and financial details.

## Configuration and pilot controls

- `WHATSAPP_ENABLED=false` by default: global worker/UI kill switch.
- `WHATSAPP_PROVIDER=wa_akg`: no silent fallback to another provider.
- `WHATSAPP_PILOT_BUSINESS_IDS`: exact UUID allowlist, invalid input fails closed.
  The approved release must contain exactly the one independently verified pilot UUID.
- `WA_AKG_BASE_URL`: HTTPS origin only; no URL credentials, path, query or fragment.
- `WA_AKG_API_KEY`, `WA_AKG_SESSION_ID`: server-only credentials; never NEXT_PUBLIC.
- Vercel Preview is forcibly disabled even if the enable flag is set. Do not copy
  production gateway secrets into Preview.
- `private.whatsapp_pilot_businesses` independently authorizes opt-in in SQL.
  Migration creates an empty table; deployment must provision only the approved
  business. Authenticated clients and service-role REST cannot edit this allowlist.

Changing an environment flag does not change persisted booking preferences or
silently select Email. When globally disabled, new UI choices disappear and the
worker performs no database or provider call. Existing opted-in transactions can
still queue intents; they remain paused until re-enabled. Turning off the private
DB pilot flag also prevents new WhatsApp intents. Disable at booking level cancels
pending intents and preserves the Email choice; an in-flight handoff may complete.
No automatic bulk replay or UNKNOWN replay is available.

## Preferences, consent and tenant boundary

Pilot creation shows Email checked and WhatsApp unchecked. At least one channel
is required. WhatsApp needs an explicit international `+` number and a separate,
unchecked vendor confirmation of customer consent. Normalization removes only
spaces, parentheses and hyphens; no country is inferred. SQL and server validation
both enforce E.164 and consent. `consent_at` and `VENDOR_CONFIRMED` record evidence.
Consent is booking-specific; there is no global marketing/broadcast consent.

`booking_communication_preferences` is member-readable and written only through
membership-checked RPCs. Composite business/booking foreign keys prevent tenant
mixing. `whatsapp_events` exposes only delivery presentation columns to members;
phone numbers, capabilities, leases and provider IDs are not in that projection.
Private attempts, pilot configuration and encrypted capabilities have no direct
anon/authenticated/service-role access. Worker RPCs are service-role-only;
new SECURITY DEFINER functions have an empty search path, explicit ownership and
revoked default execution grants. Replaced domain functions retain their ACLs.

## Durable outbox, retries and status

`whatsapp_events` is unique by business, booking, semantic event and source.
A SHA-256 stable intent key is sent as `clientMessageId`. Each attempt has a
separate durable lease and monotonically increasing attempt number. Claims use
`FOR UPDATE SKIP LOCKED`, so overlapping workers cannot claim the same intent.
The existing minute notification receiver adds an independent `after` callback;
the current push/in-app processor is unchanged. **CADENCE UNCHANGED.** One event
is processed per invocation. The adapter has a 7-second network deadline and
bounded response bytes. There is no queue service or new scheduler.

Only gateway 429 or the exact proven `NOT_ACCEPTED/session_disconnected` response
can retry, at 60/120 seconds and a maximum of three attempts. Network ambiguity,
5xx, malformed responses, collisions, lost results and expired 45-second leases
terminate as UNKNOWN; they are not automatically retried. Worker finalization is
lease-conditional. Database failure after provider acceptance does not trigger a
second handoff. This favors duplicate prevention over guaranteed delivery.

ACCEPTED means the gateway returned a provider ID. It does not mean DELIVERED.
No trustworthy signed delivery webhook is available for this pilot; no webhook
was added. DELIVERED/READ are reserved states and are never manufactured from
acceptance. Booking details display UNKNOWN as “Delivery status uncertain”.

## Capability retention and privacy

The existing token hash, purpose, expiry, revocation, usage and business checks
remain authoritative. A minimal token envelope is encrypted with pgcrypto AES256
using Vault secret `mykustomers_whatsapp_capabilities_v1` (64 random hex chars).
The key is not returned to the app. The worker receives plaintext only during an
active lease; neither message bodies nor plaintext capability tokens are persisted
in WhatsApp tables. Feedback reuses the existing delivery-generated token and key
scheme, including repeated delivery when WhatsApp-only has no email row. Link-bearing events older than 48 hours or revoked/used/expired sources
cannot dispatch. This bounds use, not physical retention: encrypted envelopes
and status tombstones are retained in this phase. A deletion/retention policy and
key rotation procedure remain prerequisites for general rollout.

Adapter errors use fixed classifications. Do not log request bodies, phones,
capability URLs, credentials or raw provider exceptions. Do not commit recipient
allowlists. Admin Security & Health shows only configured state, provider health,
connection and aggregate pending/unknown/recent failure counts. Its access remains
restricted to an active platform super-admin.

## Gateway prerequisite and rollout order

Gateway commit `d962ffb01262e627195e1056ddc2d63835d3d4e4` adds a durable MySQL
`PilotSendRequest` reservation before Baileys handoff. Same ID and HMAC payload
digest replays the recorded result; differing payload returns conflict. Interrupted
PROCESSING records become UNKNOWN on startup. The table retains no plaintext
recipient or body. Tombstones must not be deleted while retries remain possible.
The narrow authenticated endpoint is `/internal/v1/messages/text`; existing
recipient allowlist, rate limit and single-send gate still apply.

The gateway commit and additive MySQL table are deployed and HTTPS/session health
returned connected without QR. No Phase 2 message has been sent. The gateway's
recipient allowlist remains empty. Review the separate draft [gateway PR #1](https://github.com/davidfrank96/wa-akg/pull/1)
and [application PR #89](https://github.com/davidfrank96/MyKustomers-main-app/pull/89).
Neither PR is merged. The gateway change is already deployed as the backward-compatible prerequisite.

Release sequence, once approved:

1. Review the gateway commit, app diff and migration; obtain all executable CI gates.
2. Apply `20260923001137_whatsapp_pilot_channel.sql` through the normal controlled
   migration process. Provision the Vault key and only the verified pilot UUID.
   Do not apply schema changes from PR CI.
3. Verify Preview with fixture data and WhatsApp disabled; merge only after checks
   and deploy with the global kill switch still false.
4. Provision production-only provider settings; verify health and resource headroom.
   Add only the explicitly authorized controlled recipient to the private gateway
   allowlist. Never enable customer-wide sending or infer new recipient permission.
5. Enable only the pilot, run the agreed synthetic booking lifecycle smoke, record
   provider IDs and actual status, compare the exact Email/WhatsApp capability,
   inspect sanitized logs and resources, then restore the recipient guard.
6. Stop on sustained available RAM below 150 MiB, rising swap, OOM/restart churn,
   reconnect loops or unreliable sends. Do not resize or provision paid resources.

Rollback is operational: set `WHATSAPP_ENABLED=false`, remove allowed recipients,
and disable the private pilot row. Preserve durable records and encryption keys;
do not delete history or drop the migration. Existing Email choices stay intact.

## Verification and outstanding gates

Focused unit/integration, native disposable SQL and browser evidence is recorded
in `TESTING.md`. Full lifecycle verification additionally used a schema-only
export with synthetic rows in a disposable local PostgreSQL cluster, exercising
the actual original lifecycle functions. It did not mutate the cloud database.
Production-backed migration/Vault testing was rejected by automatic approval
review; no attempted production rollback test executed. The local alternative
completed. Production migration, Vault provisioning, pilot settings and real
controlled sends therefore remain a separate blocked release gate.

Protected runtime security requires an approved non-production Supabase target.
Do not relabel production as test to bypass that gate. Required main PR CI,
production deployment, Sentry and post-pilot resource evidence remain pending.
The prior PR #88 timezone hydration finding is outside this change and must not
be suppressed or silently bundled into Phase 2.
