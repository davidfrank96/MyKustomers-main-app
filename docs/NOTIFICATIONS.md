# Notifications

Status: IMPLEMENTED — DEVICE VERIFICATION PENDING; deployed to Production. Updated 2026-09-12.

The user approved both complete SQL proposals after the historical
[approval report](NOTIFICATIONS_APPROVAL_REPORT.md). The exact
[`foundation SQL`](../supabase/migrations/20260912001130_pwa_notifications_foundation.sql)
is now applied to My Kustomers after local PostgreSQL tests and a complete
rollback-only compile against the actual schema. Live RLS/ACL/catalog checks pass.
The separately approved
[`scheduler SQL`](../supabase/migrations/20260912002523_pwa_notification_scheduler_activation.sql)
is applied after deployed receiver verification. The minute job is active, with
successful scheduled HTTP 202 acknowledgements and completed worker runs.
Production VAPID and worker credentials, including the explicitly approved
Vault copy, are configured. See [the release report](NOTIFICATIONS_RELEASE_REPORT.md)
for final release, verification and physical-device limits.

## Permanent invariants

> Application notifications are durable authenticated user events. Web Push is
> an optional best-effort delivery channel and must never become authoritative
> for booking or customer workflows.

> Lock-screen push notifications contain minimal operational information and
> never include customer contact details, private feedback, payment amounts,
> capability tokens or internal business notes.

## Audited starting state

Clean `main`, fetched `origin/main`, and Production all resolve to
`d9261d481fc5490635c8666480897e4eb39556ee`. Work is on `feat/pwa-notifications` in
the original checkout. Production deployment
`dpl_nRFjLqPA3fL2U6s1Q39AJKE8Sx8Z` was READY. No other worktree or local changes
were present. Remote historical feature branches exist; none is incorporated
into this work beyond current main.

| Foundation | Observed state |
| --- | --- |
| SERVICE WORKER | ABSENT |
| WEB PUSH | ABSENT |
| PUSH SUBSCRIPTION STORAGE | ABSENT in repository and configured live catalog |
| NOTIFICATION DATA MODEL | ABSENT in repository and configured live catalog |
| BADGING | ABSENT |
| Scheduler | No `vercel.json` cron, pg_cron, pg_net, or cron schema |

`public/manifest.webmanifest` supplies `name: My Kustomers`,
`short_name: Kustomers`, `display: standalone`, `scope: /`, `start_url: /`,
192/512 icons, maskable and monochrome icons. There is no explicit manifest
`id`; the start URL supplies the fallback identity. Keep that identity. Existing
installation uses browser/Home Screen facilities; no custom install-prompt
component or `beforeinstallprompt` handler exists to duplicate.

No offline private-data cache exists. The shell's `PwaReliabilityCoordinator`
reconciles on long resume/BFCache/reconnection, defers during dirty forms/dialogs,
and retains the existing visible-only booking snapshot interval. Preserve these
rules and the native file-picker flow. Existing `reschedule_booking_with_notification`
means customer email, not vendor push, and is not duplicate push infrastructure.

The configured database is the Production-backed London project
`xtwzdgxbnlplsvcnmeje`. Inspection used catalog-only SQL with
`default_transaction_read_only=on`. The Supabase connector exposed a different
project, so it was not used as evidence or as a mutation target.

## Applied data model and grants

| Object | Purpose and retention | Access |
| --- | --- | --- |
| `public.notifications` | Per-user business/booking event, type, source UUID, generated dedupe key, timestamps; 90 days | Authenticated own rows plus current membership and enabled account; SELECT and UPDATE of `read_at` only |
| `public.notification_preferences` | Three account-wide push categories; retained with account | Own enabled account SELECT/INSERT; UPDATE of the three category booleans only |
| `public.push_subscriptions` | Up to 20 device endpoints per user, encryption keys, generation, platform, timestamps; expired at 180 inactive days, revoked cleanup after 30 days | Own safe summary SELECT only; registration/removal through self-scoped authenticated RPCs |
| `private.notification_push_deliveries` | One notification/device attempt state, lease, generation, HTTP status; 7 days, delivery horizon 24 hours | No direct role grants or policies; service-only claim/finish RPCs |
| `private.notification_overdue_receipts` | One UUID/timestamp per booking lifetime, cascading on booking deletion | Private, no role grants or policies; prevents repeat alerts after 90-day history cleanup |

Every new table has RLS. No anonymous grants. PostgreSQL owns every new object;
all new privileged functions have empty search paths and explicit ACLs. Internal
emission is available only to triggers/privileged functions. Four service RPCs
are executable only by `service_role`: process overdue, claim delivery, finish
delivery and bounded maintenance. Two private self-scoped helpers support RLS;
they derive identity with `auth.uid()`. This follows the repository's existing
public-RPC/private-helper pattern without exposing privileged arbitrary-user
lookups. Ordinary users cannot insert notifications or select device secrets.

The delivery table is justified by independent retries for multiple devices,
atomic leasing and permanent endpoint invalidation. The receipt table is required
to reconcile bounded history with “once per overdue booking”; deleting it every
90 days would reintroduce spam. Neither table stores rendered payloads or PII.
Composite foreign keys enforce booking/business and notification/device/user
consistency. No existing booking, customer, payment or email data is rewritten.
The only addition on an existing table is a partial `(scheduled_for, id)` booking
index for the worker's global scan; the live schedule indexes all begin with
`business_id`. Its ordinary transactional creation can briefly block writes;
review table size and the query plan before application/activation.

## Event and recipient policy

| Type | Authoritative event | Recipients | Intended booking anchor | Dedupe key |
| --- | --- | --- | --- | --- |
| `CUSTOMER_CONFIRMED` | INSERT of immutable `booking_confirmations` | Active owner/member | `#customer-confirmation` | Type + confirmation UUID, per user |
| `CUSTOMER_FEEDBACK_RECEIVED` | INSERT of private `feedback` | Active owner/member | `#private-feedback` | Type + feedback UUID, per user |
| `BOOKING_OVERDUE` | Server detects first overdue state | Active owner/member | Booking detail | Type + booking UUID, per user; persistent booking receipt |
| `AMENDMENT_RESPONDED` | Amendment `PENDING_CUSTOMER → CONFIRMED` | Active owner/member | `#booking-changes` | Type + amendment UUID, per user |
| `ADD_ON_RESPONDED` | Add-on `AWAITING_CUSTOMER → CONFIRMED` | Active owner/member | `#booking-addons` | Type + add-on UUID, per user |

The user approved both additional types; their event triggers are applied. The existing customer actions change agreed terms or confirmed add-ons
and require vendor awareness. Current workflows offer customer confirmation,
not accept/reject choices, so notification copy should say “Customer confirmed
changes” and “Customer confirmed an add-on”; no rejection event is invented.
They share the Customer confirmations preference, preserving three controls.

Both current roles manage bookings under membership RLS. Active membership,
completed business onboarding and `auth.users` deletion/ban state are checked at
emission, visibility and delivery claim. Unrelated platform admins receive
nothing. Membership deletion removes that user's business notifications and
pending deliveries immediately; endpoint subscriptions remain account-scoped.

No vendor create/edit/payment/delivery/settings action has a notification
trigger. There is no trigger on routine booking updates. Customer events insert
the durable notification and device queue in the same database transaction;
other sessions can see them only after commit. No network operation runs in the
transaction. A push provider outage therefore cannot fail the domain event.
Database insertion/constraint failure still rolls back the transaction, as with
the existing durable email outbox; do not conceal database failure as success.

Overdue uses the existing exact predicate:

```sql
scheduled_for < now()
and status not in ('DELIVERED', 'COMPLETED', 'CANCELLED')
```

Null schedule is excluded by comparison. DRAFT and AWAITING_CUSTOMER remain
included because Dashboard/Bookings already include them. Use timestamp
comparison, not a calendar-date or local-midnight interpretation. The migration
seeds only receipts for bookings already overdue at rollout, preventing a
historical push burst. Newly observed overdue bookings are locked, receipted,
and emitted atomically in batches of 100 (maximum 500). Later rescheduling does
not reset a booking's receipt. No follow-up reminder or digest is included.

## Application integration

Keep the server SDK and Zod notification validation under `server-only` modules.
Client contracts contain only types and lightweight constants so UI imports do
not pull validation into shared browser chunks. Registration API
must verify a fresh Supabase user, same-origin request, bounded JSON (8 KiB),
endpoint allowlist and Web Push key shape; derive user ID exclusively on server.
RLS and the registration RPC remain authoritative if API validation is bypassed.
Endpoint hashes are globally unique: one endpoint cannot belong to two accounts.
Registration locks the per-account quota, returns an existing ID for duplicates,
and rotates generation on key replacement/re-enable so queued old work is skipped.
Explicit logout must remove this device's subscription before ending the session;
failed logout cleanup must be visible and retriable. Cross-account reassignment
is denied, not silently performed. No subscription heartbeat should re-enable a
revoked device. Re-subscribe from an explicit user action after expiry/key change.

Add a compact labelled bell to the existing vendor header and a bounded list in
the existing design system. Render title/type, business name, booking reference,
timestamp and textual unread state; cap badge text at `9+`. Show “You're all
caught up.” Include mark-all-read if simple. Use current authenticated RLS
queries, descending `(created_at, id)` keyset pagination, and no persistent tenant
cache. Refresh unread data on app open, safe resume, list opening, and a received
push message; do not create a client timer that decides when business events occur.

Settings should explain the three operational categories and optional phone
push. No automatic OS prompt on load/login/onboarding/resume and no repeated
contextual nag. The explicit Enable notifications handler must call permission
directly before any awaited network operation. Defaults are enabled categories,
but no push delivery exists until a device is explicitly subscribed. Preferences
affect push, not durable in-app history. App and service-worker badge APIs must
be feature-detected; update/clear after reads and reconciliation. A badge cannot
be guaranteed to synchronize on another idle/offline device until it reconciles.

| State | UX |
| --- | --- |
| Default | Stay updated explainer; Not now / Enable notifications |
| Granted + valid registered subscription | Enabled for this device; disable action |
| Granted but absent/expired subscription | Enable notifications/reconnect; do not falsely report enabled |
| Denied | Notifications are blocked for My Kustomers. You can enable them from your browser/device settings. |
| Unsupported | Explain unsupported browser; in-app list remains available |
| iOS browser, not Home Screen | Install My Kustomers on your Home Screen to enable notifications; Share → Add to Home Screen guidance |
| Subscription error | Safe retry action without exposing provider or subscription details |

iOS/iPadOS Web Push requires a supported Home Screen web app and a direct user
gesture on iOS/iPadOS 16.4+. Detect `isSecureContext`, `serviceWorker`,
`PushManager`, `Notification`, `showNotification` and standalone display mode;
use iOS heuristics only for contextual install guidance. Supported Android
Chromium browser push does not require installation. See
[WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
and [WebKit badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/).

## Service worker, privacy and deep links

Add one `/sw.js`, registered only from the authenticated shell (not public
capability pages). It must have no `fetch` handler or CacheStorage use. Serve
the script with revalidation/no-store and a restrictive worker CSP. Preserve the
current manifest ID fallback, icons, install behavior and resume coordinator.

Version and bound the incoming JSON to 2 KiB. Accept only an allowlisted type,
notification UUID and bounded unread count. Derive title/body/icon in trusted
code; reject arbitrary `title`, `body` and `url`. Use the durable notification
UUID for the notification tag and a stable Web Push topic; `renotify: false`.
Malformed data must not throw; show a generic safe notification opening the
authenticated notification list when user-visible push is required by platform.

| Type | Lock-screen title | Body |
| --- | --- | --- |
| Customer confirmed | Customer confirmed | A booking has been confirmed. Tap to view. |
| Feedback | Feedback received | New customer feedback is available. Tap to view. |
| Overdue | Booking needs attention | A booking is overdue. Tap to review it. |
| Amendment | Customer confirmed changes | Booking changes have been confirmed. Tap to view. |
| Add-on | Customer confirmed an add-on | A booking add-on has been confirmed. Tap to view. |

Click closes the notification and constructs **only**
`/notifications/open/<validated-notification-uuid>`. A server resolver outside
the current-business dashboard layout must require Auth, query the user's
notification with RLS, verify active membership/booking access, set the business
cookie using the existing helper, mark read and redirect to the real
`/bookings/<uuid>` anchor above. Use this same resolver for in-app items. Never
use the currently selected business cookie as the notification's business.
When logged out, `requireUser` preserves this safe resolver in `next`; normal
login/callback returns there. Missing/expired/revoked items show an unavailable
state; they never restore old authority. Restrict worker focus/navigation to
same-origin vendor windows; open a separate window if the existing one is a
public customer capability page or has unsaved work. Never deliver a capability
URL or customer content in push. A request already handed to a provider cannot
be recalled after membership revocation; it remains generic and its destination
still enforces current authorization.

Endpoint registration allows only known FCM, Mozilla and Apple push service
origins over HTTPS. The server sender must repeat validation, disable redirects,
set finite connection/request timeouts, and never use a client-supplied proxy.
Do not log endpoints/keys. Expected permission denial is not an error. Unexpected
failures may report only fixed operation/outcome tags to the existing Sentry
sanitizer. Do not capture raw SDK errors, request options, payloads or bodies.

## Delivery, retries and scheduler

The worker claims two devices immediately before each send, with at most four
batches per invocation (eight sends/minute at the current schedule). The RPC hard
limit is 100. Row locks use `SKIP LOCKED`, a random token and a two-minute lease.
Sender concurrency is two, with an eight-second total HTTP timeout. This bounds
current load; monitor pending work and revisit capacity when traffic grows. A queue claim rechecks
user/membership, preferences, unread state, active subscription and generation.
Use a fresh claim immediately before sending rather than keeping a long-lived
batch. The 24-hour delivery horizon prevents stale lock-screen alerts.

The authenticated receiver returns HTTP 202 after validating the bounded empty
JSON body, then uses Next `after` to retain the worker within its 60-second
function lifetime. This keeps the scheduler’s 10-second HTTP timeout independent
of slower provider attempts. HTTP 202 acknowledges scheduling only; delivery
rows and fixed Sentry failure messages describe processing outcomes. Runtime
logs record only completion counters (overdue, processed, accepted, unknown)
or a fixed failure message, never user IDs, endpoints, keys or payloads.

Provider 2xx means accepted handoff, **not proven device delivery**. 404/410
revokes the matching subscription generation. Only explicit 429/5xx responses
are retried, at most three attempts; wait at least 60 seconds then 300 seconds
and honor a longer Retry-After up to one hour. Beyond that bound, stop. A
connection timeout, process crash, or expired sending lease has an ambiguous
outcome: mark `unknown`, do not resend blindly. This trades some best-effort
push delivery for duplicate avoidance; the in-app record stays durable. Delivery
completion is conditional on the lease token. Never retry the booking/customer
action to repair push.

Vercel team inspection confirms **Hobby**. Its [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
allow daily jobs only; a once-per-minute Vercel cron would require a paid plan
change. No upgrade is requested or configured here.

Approved scheduler: enable `pg_cron` 1.6.4 and `pg_net`
0.20.4 (verified available at preflight) on the
existing Supabase project and create **one once-per-minute job**,
`myk-notifications`, calling the fixed HTTPS POST
`https://mykustomers.com/api/internal/notifications/process`. Store a separate
random worker bearer secret in existing Supabase Vault and Vercel server env;
never use a Supabase service-role token as the HTTP worker credential. The worker
performs overdue detection, bounded dispatch and maintenance. This uses existing
providers but adds up to 1,440 requests/day and database/function usage; check
available plan budgets before activation. The scheduler is a separate approved
forward migration after worker deployment, not part of the foundation SQL.

The approved schedule command, after the receiver and Vault credential are ready, is:

```sql
select cron.schedule(
  'myk-notifications', '* * * * *',
  'select private.invoke_notification_worker();'
);
```

`private.invoke_notification_worker()` must have an empty search path and no
public/anon/authenticated execution rights. It reads only a named Vault secret,
uses `net.http_post` to the fixed URL, a 10-second timeout and an empty JSON body;
never places the bearer secret in `cron.job.command`.

Live activation found a managed-platform limitation: `supabase_admin` owns the
`net` schema/tables/functions and their PUBLIC grants. The tenant `postgres`
role's approved REVOKE statements produced warnings and did not change those
ACLs. Do not report `has_schema_privilege` or `has_table_privilege` as false.
Supabase documents that [these grants are isolated from clients](https://supabase.com/docs/guides/database/extensions/pg_net#permissions)
because `net` is not exposed through the Data API and API roles cannot log in to
PostgreSQL. Release verification confirmed anon and a controlled authenticated
user receive HTTP 406 / PGRST106 for both net tables, `net.http_post`, and the
private worker RPC. The controlled user was removed without email. GraphQL
reports its extension disabled. No public/graphql_public SECURITY DEFINER
function references net or Vault, and ordinary roles cannot execute
`private.invoke_notification_worker()`.

Keep net/private out of exposed schemas and never add a general SQL or net/Vault
wrapper callable by client roles. Actual owner-level ACL revocation requires
Supabase-managed privileges; it is an outstanding defense-in-depth limitation,
not a verified ACL restriction. Recheck catalog and API boundaries after schema,
extension or API configuration changes.
Supabase documents this [Cron + pg_net + Vault pattern](https://supabase.com/docs/guides/functions/schedule-functions).
Activation follows authenticated receiver verification. Daily polling is not
equivalent to this approved cadence.

This implementation uses the minute scheduler for all dispatch; there is no
extra callback or network work added to customer actions. Committed events are
queued atomically and normally picked up by the next worker invocation. Neither public browsers
nor service workers initiate domain-event generation. No new marketing engine,
Firebase, native dependency, email provider or SMS system is proposed.

## VAPID and dependency

One generated VAPID pair and a separate random worker bearer credential are
configured in Production Vercel scope and the ignored local environment file:

| Name | Visibility |
| --- | --- |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Public browser subscription key |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Server only; never logs, client bundles or reports |
| `WEB_PUSH_VAPID_SUBJECT` | `mailto:hello@mykustomers.com`, documented operational alias in DOMAIN_EMAIL_INFRASTRUCTURE |
| `NOTIFICATION_WORKER_SECRET` | Server/Vault only; distinct from VAPID and email credentials |

Production and an isolated Preview/test environment must use separate device
subscriptions; no Production secret should be copied to an untrusted Preview.
No environment change is needed for positioning.

Installed library: exact `web-push@3.6.7`, with `@types/web-push@3.6.4` for development.
The published release metadata is dated 2024-01-16, so it should not be described
as recently released. Upstream is the established Web Push library; reassess
maintenance during future dependency reviews. Its isolated resolved dependency tree had **zero
known npm audit vulnerabilities**. The application lockfile is committed with this feature.
Browser APIs create subscriptions and display notifications; server sends still
need RFC-compliant payload encryption and VAPID signing, which this
[library implements](https://github.com/web-push-libs/web-push). Keep it in Node
server bundles only. Do not hand-roll cryptography or add unrelated notification SDKs.

## Ordering, rollback and verification

1. Approve the exact foundation SQL plus event/recipient/retention policy.
2. Verify no drift in columns/enums, existing grants, triggers, booking indexes
   and extension versions. Validate SQL against an isolated approved database;
   static parsing alone is not runtime/RLS proof. No Docker.
3. Apply the exact foundation file once, transactionally; record its hash and
   catalog/grant checks. It is deliberately additive and non-idempotent so an
   unexpected existing object fails rather than being silently overwritten.
4. Complete application/worker implementation and typed database contracts;
   finish focused security/behavior/browser tests on the approved test target.
5. Configure VAPID/worker secrets only after approval. Complete Preview, PR and
   required CI; merge/deploy only after those gates.
6. Apply the separately approved scheduler activation SQL after the receiver exists.
   Verify extension/request-table ACLs, successful authenticated invocation,
   quotas and retention cadence. Enable controlled devices last.

Before commit, any SQL error rolls back the whole foundation. After release,
disable the schedule/sender first, then roll back application code. Keep the
additive tables to preserve durable history and overdue receipts. If trigger
insertion itself is faulty, use a separately reviewed forward migration to
disable only the four new customer-event triggers; retain the membership-removal
trigger where possible. Do not drop shared extensions, rewrite old migrations,
reset receipt history or delete booking/customer/email data as rollback.

The verification contract includes all five event types, commit rollback/no emit,
duplicate/concurrent submissions, one logical row/two devices, no vendor-action
noise, exact overdue boundary/null/delivered exclusions, repeat checks and
history-expiry dedupe, both roles, ban/delete/revocation, cross-tenant denial,
endpoint quota/concurrent ownership, key rotation, CSRF, arbitrary URLs, malicious
payloads, retry leases/Retry-After, 404/410, ambiguous timeouts, provider outage
independence, same-business and other-business clicks, expired-session login,
unread/badge reconciliation and keyboard/focus/list semantics.

Verify notification UI at 320/360/375/390/430/768/1024/1440, including long context,
empty/blocked/install/error states, header alignment and bottom-nav clearance.
Compare cold startup and Dashboard/Bookings/Customers timing; confirm no client
SDK bundle, no extra startup blocking fetch and no private worker cache. Retest
install, resume, navigation, file picker and worker lifecycle. These notification
UI checks now pass in Chromium and WebKit across all eight widths. Isolated
PostgreSQL exercises the schema and concurrency; unit tests exercise SDK encryption,
transport outcomes, access boundaries and worker events. Native notification APIs
are explicitly mocked in browser permission tests. Final results and remaining
manual checks are in the release report; no test claims physical device delivery.

REAL IOS PUSH — NOT VERIFIED. REAL ANDROID PUSH — NOT VERIFIED. Emulated WebKit
and Chromium cannot prove physical Home Screen delivery, lock-screen display,
tap behavior, Focus/badge settings, process eviction or native permission UX.

## Implemented files and operational limits

- `features/notifications`: shared contracts, client feature detection, bounded
  authenticated HTTP helpers, SDK sender, worker authorization and logout cleanup.
- `app/api/notifications`: inbox/count/pagination, read state, preferences, device
  registration/removal. Authentication derives identity; no arbitrary user ID.
- `app/notifications/open/[notificationId]`: fresh Auth and RLS booking resolution,
  cookie business selection, read marking, safe login continuation and real anchors.
- `components/notifications`: header dialog/list, Settings card and logout form.
- `public/sw.js`: trusted generic copy, 2 KiB payload cap, UUID tags, optional badge,
  safe resolver clicks. No fetch/cache handler. The script is served no-store.
- `app/api/internal/notifications/process`: Node receiver, constant-time secret
  check, 256-byte empty JSON body, fixed safe telemetry and 60-second function cap.

The public Preview has no Production runtime credentials. It can verify public
copy, script/manifest/header delivery, missing-auth behavior and secret exclusion;
authenticated UI tests use loopback fixtures. Protected cloud runtime-security
checks remain disabled until a dedicated approved test project is configured.
Neither an accepted provider HTTP response nor emulator success proves delivery
to a physical phone. App badges on idle/offline devices reconcile on next use.
