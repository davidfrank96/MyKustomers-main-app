# WhatsApp Phase 3 — business feature access and vendor experience

Status: IMPLEMENTED — VERIFICATION PENDING. Base main and Production: `82e936101439188726e3bab9ac9ee5d39a852c49` (merged PR #89). Existing worktrees and PR #86 remain untouched. No billing or subscription implementation.

## CURRENT MY KUSTOMERS UI LANGUAGE

Audited before implementation: Dashboard, Bookings, New Booking, Booking Details, Customers, Customer Details, Insights, My Profile, Settings, Notifications, shared primitives and navigation, and all four existing WhatsApp components.

- `WorkspacePage` supplies route-specific maximum width, 16px mobile gutters, 32px tablet and 40px desktop gutters. Creation/Settings/Profile use the existing constrained column; Booking Details retains its journey and disclosures.
- Shared `Card`: `rounded-lg`, `border-border`, `bg-card`, restrained 1px shadow. No messaging-provider colors. New Booking sections use 16/20px padding and 36px muted icon tiles with 16px Lucide icons.
- Inter typography; normal tracking. Page headings use 26/30px, section headings 16px semibold with 24px line height. Field/help/status text is normally 14px with 20–24px line height. Auxiliary text uses 12px.
- Existing form controls are 44px high, rounded-md, with visible focus and muted placeholders. Form groups use 12–20px gaps and stack before sm/md. Errors remain inline and accessible to the existing form-error navigator.
- Primary color is the existing dark green `#175c4d`; neutral cards/backgrounds and restrained amber/red attention states communicate through text as well as color. No WhatsApp-green surfaces or provider terminology on vendor pages.
- Five existing mobile destinations, safe-area padding, scrollable normal document and stable keyboard behavior remain. Desktop navigation starts at the existing lg boundary. Breakpoints remain sm 640, md 768, lg 1024 and xl 1280.
- Settings reuses Card/Header/Title/Content; Admin business details use compact sections and existing privileged confirmation dialogs. Async content keeps the existing loading/skeleton conventions.

## Scope

Reuse BookingCommunicationFields, BookingForm, BookingUpdates and WhatsAppAdminHealth. Add a generic entitlement for `WHATSAPP_CUSTOMER_UPDATES`, independent of operational rollout and the global kill switch. No pricing, plan labels, subscription provider, automatic default channel or gateway architecture rewrite.

Only Frankenstein (`9475fe63-5b03-4682-a159-a7d3a0ef7c10`) is authorized. The paired account remains test-only. A dedicated WhatsApp number is required before general customer rollout. No Phase 3 transport sends are needed because Phase 2 already proved transport.

## Enforcement and recovery

Server membership + entitlement + operational rollout authorize opt-in. Database enqueue, claim and dispatch recheck entitlement. Revocation prevents new intent, cancels pending unsent work and preserves historical/accepted/unknown evidence and Email. A provider call already in progress may finish. Re-grant does not replay cancelled/unknown work. No public or ordinary authenticated grant path.

Future Pro → grants WHATSAPP_CUSTOMER_UPDATES through the same feature boundary; no billing code today.

## Verification

Isolated database tenant/AAL2/revoke tests and the full original booking lifecycle passed. The focused server/worker/adapter/action cases passed. Final browser matrix and the full verification cycle passed (details below). Required CI, exact production SHA and controlled entitled/non-entitled live UI verification remain release gates. Physical-device keyboard behavior must be distinguished from browser emulation.


## Operational policy

Product entitlement uses `business_feature_entitlements`; it is not a commercial plan and does not itself enable sending. Availability additionally requires the global switch, environment rollout list and private SQL rollout row. Provider connectivity is checked by the bounded worker; booking creation never synchronously depends on the gateway. Missing/error entitlement reads fail closed. Preview remains OFF with no gateway credentials.

Super Admin changes use the existing privileged dialog, a required reason and fresh AAL2 server authorization; SQL independently checks active platform membership/AAL2 and writes an immutable audit event. A controlled owner bootstrap uses source PILOT and identifies the database operator honestly. Future billing must authenticate its events before calling the owner-only generic mutation boundary.

Email-only submission remains on the existing Email booking RPC even if access changed after the page rendered. Historical outcomes remain visible independently of future-update availability. Revocation cancels PENDING only; PROCESSING is checked again before dispatch, and a call already in progress may finish. Re-grant never replays CANCELLED or UNKNOWN work.

Pre-release gateway observation: 514.4 MiB RAM used, 447.1 MiB available, swap 0; Node RSS about 126.7 MiB/heap 29.3 MiB; MySQL RSS 154.4 MiB; load 0.06/0.04/0.01. Zero disconnects/reconnect attempts/automatic restarts or error/OOM/QR log matches since the last Phase 2 cleanup restart. Existing gateway Droplet remains s-1vcpu-1gb at $6/month with no backups or attached volumes. No new infrastructure or sends.


## Full verification cycle — 2026-09-23

One local final cycle: lint/typecheck PASS; Vitest 1,142 passed with 24 existing opt-in skips; guarded Runtime Security 21/21 SKIPPED; local E2E 40 passed / 62 credential or opt-in skips; production build PASS; dependency audit zero vulnerabilities; whitespace check PASS. Profile/Social PASS (49); Notification Contracts database/concurrency PASS and browser PASS (24); WhatsApp UI PASS (10 across Chromium/WebKit), including the exact ten-size matrix, phone/consent resets and Admin grant/revoke. Screenshots of mobile New Booking, status, Settings and Admin were visually reviewed against the audited primitives; no overflow or new navigation layout. These local counts are not evidence of credentialed cloud E2E.

The four live Phase 2 function bodies were compared exactly against the approved migration before preparing the Phase 3 migration. SHA-256: `cee25f9a5fe69e83aaba7bc5afc61133bd96a273cebc08ff9ed5016b958307b7`. Production preflight reconfirmed the exact Frankenstein active owner relationship, zero pending/processing WhatsApp events and no other operational pilot business. No production mutation has been made at this documentation checkpoint.


Read-only Supabase security advisors ran through the authorized database connection. The two baseline warnings concern pre-existing `private.set_updated_at` and `private.prevent_customer_business_id_change` search paths; neither is changed by this task. The linked-management command could not authenticate, so it was not used against any other project. Post-migration advisors must confirm no new warnings.


## CI recovery

Initial PR #90 CI identified two existing test-harness timing failures: Linux WebKit surfaced navigation-cancelled notification requests, and the eleven-route authenticated onboarding walk exhausted its 30-second total budget. The navigation test now requires the existing hydration-ready marker before waiting for network idle/screenshots/navigation. The onboarding test retains every per-assertion limit and all eleven route assertions, with a 90-second total journey budget. No product authorization, layout/error assertion, test skip or CI gate was relaxed. Three focused local WebKit reruns passed before the readiness correction; three focused WebKit reruns also passed after the readiness correction.


## Controlled production database acceptance

The reviewed migration was applied after local/full-schema verification and exact function-drift/hash checks. Historical counts were unchanged: 75 bookings, 95 Email events, two WhatsApp events and two attempts, with zero pending/processing WhatsApp work. Exactly one `WHATSAPP_CUSTOMER_UPDATES` entitlement is enabled: Frankenstein, source PILOT; the operator bootstrap emitted one audit event without impersonating a user. Operational rollout remains OFF at this checkpoint.

Live ACL verification confirmed RLS, no authenticated direct writes, no anonymous read, no service-role public grant RPC and no authenticated private mutation. A forged opt-in under the account’s existing other membership raised insufficient_privilege before mutation inside a database-enforced READ ONLY transaction; no synthetic rows or sends were created. Post-migration security advisors show the same two pre-existing unrelated warnings and zero new warnings.

[PR #90](https://github.com/davidfrank96/MyKustomers-main-app/pull/90) carries the final executable CI and subsequent exact-SHA production/UI acceptance evidence. General rollout remains pending the dedicated number even after productization acceptance.
