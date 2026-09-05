# Email Reliability Phase 2 — Stage 2B Migration Approval Report

STATUS: APPROVED AND APPLIED; APPLICATION VERIFICATION PENDING. The exact reviewed
migration was applied transactionally to the validated Production-backed database on
2026-09-05. Application commit, PR/CI, Vercel deployment, Brevo webhook activation,
responsive review, and controlled provider verification remain pending. The
dedicated Vercel Production secret is configured but cannot affect a deployment
until the endpoint commit reaches Production.

## A. Starting State

Stage 1 began from clean `c9905099815ca78e6ca79b42520cd63f9ed1e23e`. Production was the matching Ready Vercel deployment. Production had 42 outbox rows and 29 delivery-attempt rows; no provider-callback table or Brevo webhook existed.

## B. Phase 1 Findings Accepted

There is no Gmail-only restriction. The proven gaps were whole-address lowercasing in public confirmation, overconfident ambiguous-result wording, historical development-adapter presentation, and no post-acceptance Brevo evidence. Brevo stays primary; Resend stays pinned standby. No failover, replay, suppression change, mailbox probing, or legitimate-customer test is included.

## C. Stage 1 Branch/Commit

`fix/email-reliability-correctness`; commit `6c3d5d44995a41406b2d526404542bd383b3c592`; PR #66; merge `de0dc4950e5239b9484ece230e2dba329c4fadf1`.

## D. Public Confirmation Normalization Before

The public confirmation schema transformed the entire address with `.toLowerCase()`.

## E. Public Confirmation Normalization After

It now reuses `normalizeCustomerContactEmail`: outer trim, exact local-part preservation, domain-only lowercase. Authentication identity handling is unchanged.

## F. Domain-Only Normalization Tests

Unit/action coverage locks the three requested examples, malformed rejection, arbitrary non-Gmail domains, exact RPC forwarding, dispatch of the same immutable event, and no profile update. A read-only Production query of the shared database helper returned:
`David.Frank+Cake@hotmail.com`, `Jane.Doe@company.co.uk`, and `Customer+Order@example.ie`.

## G. Ambiguous Send Wording Before

All unsuccessful returns said the provider did not accept the email and that retry was safe.

## H. Ambiguous Send Wording After

Accepted, definite non-acceptance, ambiguous, queued/unprocessed, rate-limited, and duplicate results have distinct server-selected wording. Timeout, network uncertainty, malformed response, lost state finalization, and unknown results tell the user to avoid repeated sending. Retry eligibility and send counts are unchanged.

## I. Development-Adapter Presentation

A twice-authorized, maximum-20-ID, server-only compatibility projection selects only event IDs and tests the existing development-ID prefix. It returns no recipient or provider ID. Production row and detail smoke verified “Development adapter — no external email sent,” including a legacy row without attempt history.

## J. Stage 1 CI

PR CI run 144: Quality, Tests, Build, Dependency Security, and E2E passed. E2E passed 57 and skipped 18 controlled optional cases. Runtime Security was skipped by its protected-target guard and is not represented as a pass.

Local: lint, typecheck, build, audit (zero vulnerabilities), diff check, and 790 Vitest tests passed; 24 guarded/optional tests skipped. Isolated no-credential Playwright passed 17 and skipped 58. The real responsive admin fixture passed 12 viewport/reduced-motion tests.

## K. Stage 1 Production Deployment

Vercel deployment `Dus5rW7nnsL4hgsyRdPiauFT7Woc` is Ready, Production, and sourced from exact merge `de0dc4950e5239b9484ece230e2dba329c4fadf1`. Canonical domain: `mykustomers.com`.

## L. Stage 1 Production Smoke

Read-only live admin list/detail labels and outbox-only metric wording passed. Production database normalization passed. Public confirmation and dispatch branches were exercised synthetically/local and in required CI, not with a real customer submission or email; no customer was contacted.

## M. Existing Outbox Schema

`email_events` owns durable logical events and statuses `PENDING/SENDING/SENT/FAILED`. `email_delivery_attempts` owns attempt number, provider, origin, result, provider message ID/failure evidence and timestamps. Current invariants and RPCs remain unchanged.

## N. Proposed Provider-Event Schema

One append-only `email_provider_events` table linked by composite FK to the exact email event and delivery attempt. Stored fields are internal ID, provider, SHA-256 message key, normalized event type, provider/receipt timestamps, fixed reason category, and deterministic fingerprint. No second outbox exists.

## O. Outbox Status vs Provider Delivery Status

`SENT` continues to mean adapter/provider acceptance only. Provider state is independently `UNKNOWN/DELIVERED/DEFERRED/SOFT_BOUNCED/HARD_BOUNCED/INVALID/BLOCKED/COMPLAINT/PROVIDER_ERROR`. Development operations are excluded from external-acceptance/provider-outcome counts.

## P. Provider Event Types

Brevo callback values map as follows: `delivered→DELIVERED`, `deferred→DEFERRED`, `soft_bounce→SOFT_BOUNCED`, `hard_bounce→HARD_BOUNCED`, `invalid_email→INVALID`, `blocked→BLOCKED`, `spam→COMPLAINT`, `error→PROVIDER_ERROR`.

The current Create Webhook API subscription identifiers are `delivered`, `deferred`, `softBounce`, `hardBounce`, `invalid`, `blocked`, and `spam`. Its published enum currently omits `error`, although the transactional callback guide documents it. Do not claim an error subscription or activate configuration until this conflict is resolved with a controlled API check/Brevo support. No open/click events are in scope.

## Q. Correlation Strategy

Primary: provider + canonical provider-message-ID digest. Raw Brevo IDs stay only in existing server evidence and never enter vendor output. Secondary, for future sends only: `X-Mailin-custom: mk-attempt-v1:<SHA-256 of namespaced random attempt UUID>`. Recipient email is ignored as authority.

## R. Correlation Race Decision

A callback can arrive after Brevo acceptance but before `finalize_email_delivery_attempt` persists the returned message ID. Therefore the opaque attempt key is required. The ingestion function serializes a message digest, locks parent then attempt in finalizer-compatible order, requires one Brevo attempt, and rejects conflicting key/attempt bindings.

## S. Idempotency Strategy

Internal fingerprint = SHA-256 of `brevo/v1/<message-key>/<normalized-event>/<ts_event-seconds>`. Brevo webhook payload `id` is not used because it identifies the webhook. A unique fingerprint plus `ON CONFLICT DO NOTHING` makes sequential/concurrent replay one effect. Receipt time and arbitrary reason are excluded.

## T. Out-of-Order Strategy

All evidence remains append-only. Current state is computed from provider time, not HTTP receipt order, and only from the latest delivery attempt whose final stored message ID is absent or matches the evidence digest.

## U. Derived-State Rules

Priority is complaint > blocked > invalid > hard bounce > delivered > temporary/error. Thus delivered supersedes deferred/soft bounce regardless of callback order; older deferred cannot regress delivered. Permanent failures/complaints remain sticky. Among non-terminal outcomes the latest provider timestamp wins, with deterministic error/soft/deferred tie-breaking. A newer application attempt has its own independent state.

## V. Webhook Route

After approval: `POST /api/webhooks/brevo/transactional`, Node runtime, outside login/onboarding/customer-capability middleware. The migration does not create the route.

## W. Authentication Strategy

Dedicated, high-entropy `BREVO_WEBHOOK_SECRET`; bearer header configured using Brevo’s supported webhook `auth.type=bearer`; timing-safe digest comparison. It is not the Brevo API key and never appears in URL, logs, client code or Sentry.

## X. Body/Schema Validation

Authenticate before DB work; POST and JSON only; streaming read capped at 32 KiB; strict allowlisted projection for `event`, `message-id`, `ts_event`, and optional `X-Mailin-custom`; discard email, subject, raw reason, webhook ID, IP, mirror link, contact ID, tags and engagement fields before persistence/logging.

## Y. Webhook Response/Retry Policy

New `200`; duplicate `200`; unsupported engagement `204`; bad auth `401`; bad media `415`; oversized `413`; malformed/conflicting evidence `400`; fresh unmatched/race or transient persistence `429`; old unmatched `204`. Never return a casual `5xx`: Brevo currently stops and discards on every 5xx and every 4xx except 429. It retries 429/unresponsive delivery four times after 10 minutes, 1 hour, 2 hours and 8 hours.

## Z. Privacy/Data-Minimization Model

No raw payload, recipient, subject/body, capability, provider message ID, reason text, sending IP, mirror URL, contact ID, tag, URL, user agent or engagement data. SHA-256 identifiers are pseudonymous linkage, not anonymous data; retention/deletion governance still applies. Sentry gets categories/release only; expected auth denials, unsupported events and duplicates are not issues.

## AA. Vendor Status UX

One compact summary in Customer confirmation. Booking/customer confirmation remains primary. Provider-accepted, delivered (not opened), delayed, bounce/invalid, blocked/complaint and provider-error copy retain Share, WhatsApp and Copy link as allowed. No automatic retry/failover and no second panel.

## AB. Admin Email Operations UX

Keep outbox and recipient-delivery dimensions separate; add bounded per-row state, fixed-category timeline, and delivery totals. Internal provider IDs remain hidden. Recipient delivery attention must not relabel database/outbox infrastructure unhealthy.

## AC. Development-Adapter Historical Handling

No row rewrite/backfill. Existing adapter detection remains presentation evidence; development operations are separately counted and never external successes.

## AD. Retry/Recovery Rules

Delivered/deferred/soft bounce: no immediate repeat. Hard/invalid: correct recipient first. Blocked/complaint: no Brevo or Resend retry. Ambiguous acceptance: retain existing fail-closed policy. Recipient correction continues lock + old-link revocation + fresh hash-only capability + one new request.

## AE. Historical Backfill Decision

None. Existing Brevo rows remain `UNKNOWN`; the reserved-domain pending event remains untouched. A later bounded import would require a separate proposal.

## AF. Migration Filename

`supabase/migrations/20260904144304_brevo_delivery_evidence.sql`, created by Supabase CLI 2.116.0. SHA-256: `aabeccdb39dec9970e682db55023c4b2939fd4f1884903f76b22fe8c40421171`.

## AG. Complete Migration SQL

The complete 448-line SQL is the migration file itself; it was not abbreviated or
generated at apply time. Review [the exact migration](../supabase/migrations/20260904144304_brevo_delivery_evidence.sql).
That exact artifact was applied transactionally after explicit approval.

## AH. Tables/Columns

One table with 10 minimized columns; one composite uniqueness constraint added to attempts to support the exact pair FK. No column is added to existing rows. Three evidence indexes, two attempt correlation indexes, and one time-range reporting index.

## AI. Functions/RPCs

Pure message/attempt digest helpers; immutable-write trigger; service-only ingestion; rank/summary helpers; admin batch/total/history functions; tenant-authorized booking confirmation delivery function. Existing RPC signatures are unchanged.

## AJ. RLS

Enabled on the new public table with zero policies. Normal reads occur only through checked security-definer projections.

## AK. Grants

Table rights revoked from `PUBLIC`, anon, authenticated and service_role. Ingestion execute only to service_role. Admin/vendor read RPC execute only to authenticated and re-check admin/membership internally. Minimal private-schema usage plus digest-helper execute goes only to trusted service_role for attempt index maintenance. Owners are postgres; all definer functions use empty search paths.

## AL. Indexes

Attempt message digest and opaque attempt digest support exact correlation. Event/attempt descending indexes support history/latest state. Message+attempt supports conflict checks. Created-time supports 30-day totals. Unique fingerprint enforces idempotency.

## AM. Existing-Row Mutations

NONE. DDL builds indexes/constraints but no existing row value is inserted, updated, deleted or backfilled.

## AN. Environment Change Required

`BREVO_WEBHOOK_SECRET`, Production only, after approval. Preview/local positive tests require a separate ephemeral value, never the Production secret.

## AO. Brevo Dashboard Change Required

After migration + endpoint + secret + controlled tests: exactly one active transactional email webhook for the canonical HTTPS route; bearer auth; seven currently supported outcome subscriptions; no query secret, opens, clicks or duplicates. No sender/domain/API-key/provider/suppression changes.

## AP. Production Risk

Main risks: short DDL locks while adding constraints/indexes; callback/finalizer race; false correlation; Brevo retry loss; evidence growth; pseudonymous retention; restricted parent deletion after evidence exists; and application/schema version skew. The empty initial evidence table limits first-apply row risk. `lock_timeout=5s` and transaction rollback fail closed.

## AQ. Rollback/Forward-Fix Strategy

Before activation and while empty, rollback can transactionally drop new functions/triggers/table/indexes/attempt pair constraint. After evidence exists, do not destroy evidence: disable/unconfigure webhook first, deploy a forward fix, preserve rows, and keep vendor state unknown/safe. Roll back app display independently because existing outbox contracts remain valid.

## AR. Tests Prepared

Static migration contracts plus endpoint, provider-header, parser, Admin, Booking
Details, and bounded-reconciliation tests are implemented. Live rollback-only SQL
proved service-role ingestion, duplicate handling, unmatched/conflict outcomes,
sticky complaint ordering, and update/delete/truncate denial. Full Vitest passed
831 tests with 24 explicit optional skips; lint, typecheck, build, audit (zero
vulnerabilities), and diff hygiene passed. Protected Runtime Security correctly
skipped without its opt-in gates. Repository-wide Playwright exposed unrelated
pre-existing homepage/auth presentation drift and was stopped; phase-specific CI,
responsive, deployment, and controlled-provider evidence remains pending.

## AS. Documentation Plan

DATA_MODEL, MIGRATIONS, EMAIL_OPERATIONS, architecture, security/Sentry, TESTING,
release checklist, Booking Details, confirmation README, provider README, master
plan, deployment configuration, and changelog are updated in this implementation.
Production claims remain pending until the exact merge is deployed and activated.

## AT. Remaining Evidence Gaps

Application commit/PR/CI and Vercel deployment remain pending. The final dedicated
Production webhook secret is stored as a Vercel Secret and was rotated before use;
no deployment can read it yet and no Brevo webhook is active. No callback or inbox
was fabricated. The
Create Webhook API enum still omits `error`, so configuration must use the seven
supported subscriptions while the endpoint remains capable of safely ingesting a
documented `error` callback. Runtime Security and controlled Gmail/Outlook/.ie inbox
evidence remain pending.

## AU. Final Status

`EMAIL RELIABILITY PHASE 2B — IMPLEMENTED — VERIFICATION PENDING`
