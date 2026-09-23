# WhatsApp Admin control plane

Status: IMPLEMENTED — RELEASE VERIFICATION PENDING.

## Current Admin design-language audit (before UI edits)

The Admin shell uses a 1600px maximum width, 16/24/40px responsive gutters, a compact brand/account header and horizontally scrollable contained navigation. Email Operations supplies restrained section headings, neutral bordered cards, small badges, bounded tables and mobile-safe overflow containers. Business detail uses shared Card components and the existing reason/AAL2 privileged dialog. Security & Health is a summary destination, not another full operations dashboard. Buttons preserve 44px touch targets; ordinary section titles remain 16–20px, helper/status copy 12–14px. Use the same primary/border/muted tokens, rounded corners and spacing, with no WhatsApp-green surface or new navigation paradigm.

## Scope and boundaries

One platform sender, no per-vendor sessions, broadcasts, billing or infrastructure controls. Vendor booking/Email/outbox/capability behavior remains unchanged. Only active SUPER_ADMIN can load `/admin/whatsapp`; mutations independently require fresh AAL2, confirmation and a reason. QR is ephemeral authentication material: no logs, telemetry, screenshots, persistence or browser-to-gateway calls. All requests are server proxied and no-store. A distinct control credential belongs only in Production server and gateway secret stores.

A narrow durable pause prevents new SQL claims and gateway handoffs before session changes. In-flight work may finish; historical ACCEPTED/UNKNOWN remains untouched. Pairing abandonment leaves sending paused. Resume is explicit after connection and database health verification, preserving existing pilot/recipient restrictions. Read-only production acceptance never calls a session mutation or generates QR.

## Operational contract

GET `/internal/v1/control/session` uses X-Control-Key and reconstructs sanitized status. POST accepts exactly action + UUID operation ID, rejects unknown fields, and never accepts recipient/message input. GET `/internal/v1/control/session/qr` returns an ephemeral PNG only during the two-minute active pairing lease. My Kustomers QR/status routes are independently authorized, server-proxied and private/no-store. QR refresh is explicit; only sanitized status polls every four seconds while the pairing dialog is open, bounded to two minutes and stopped on terminal state/close. QR disappears on connection and after its twenty-second display lease.

Read-only production acceptance must leave the currently paired TEST account intact: zero message sends, QR requests, reconnect, replace or unlink actions. Deployment process restarts are recorded separately from session-control invocations. A dedicated My Kustomers number is still required before general rollout.

The existing SQL claim function checks the private pause after stale-lease and revoked-preference housekeeping; ACCEPTED/UNKNOWN and Email are unchanged. The gateway rejects new handoffs before replacement. An already-started handoff may finish; replacement reports busy and remains paused. An uncertain control call is never retried automatically. Requested and sanitized outcome audits are separate, immutable rows. Only a service-role server response can attest a successful resume; client Admin RPC calls cannot forge that result. Reasons reject contact-like numbers, email addresses and links.

Production secrets: existing WA_AKG_BASE_URL plus new distinct WA_AKG_CONTROL_API_KEY, scoped server-only to Production. No Preview credential. Local operations env remains mode 600. No DigitalOcean key in Vercel. Recovery for an unreachable process stays in the gateway guide; Admin exposes no Droplet/database/terminal action.

Gateway legacy lint/dependency findings remain outside this narrow runtime and are reported explicitly. Dedicated-number pairing/replace and physical-device behavior are not claimed by fixture tests.

## Verification and deployment evidence

Gateway control commit `b16c723c296830926fff678fc4bff7fa82833d2b` is deployed backward-compatibly; 17 gateway pilot tests, TypeScript and full build pass. Two intentional deployment process restarts restored the same paired TEST account automatically. There have been zero production control mutations, QR requests or messages from this task. The additive control migration is applied with two events/two attempts and zero pending work preserved. Gateway sample after nine minutes: 432.9 MiB available RAM, 1.0 MiB swap, 127.2 MiB Node RSS, 30.2 MiB heap, 158.8 MiB MySQL RSS, zero reconnects/automatic restarts. The existing Droplet remains $6/month, with no resource creation or resize.

The application release is pending green CI and read-only Super Admin acceptance. Native database, unit and browser fixtures cover privileged/QR/replacement paths without touching the paired Production account. Dedicated-number replacement is intentionally not exercised in Production.
