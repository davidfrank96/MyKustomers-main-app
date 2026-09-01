# Migrations

STATUS: IMPLEMENTED AND VERIFIED FOR DEVELOPMENT

Supabase PostgreSQL migrations live only in `supabase/migrations`. Repository
migrations, the configured development schema, generated database types, and
runtime security tests are the evidence set for database behavior.

## Rules

- Applied migrations are immutable. Never edit or rename an applied migration.
- Every schema, function, grant, policy, trigger, or database-contract change
  requires a new migration.
- Create files with `npx supabase migration new <descriptive_name>`; do not
  invent timestamps manually.
- Use lowercase snake-case descriptions and preserve chronological ordering.
- Review RLS, grants, function `search_path`, execution roles, and generated
  `types/database.ts` whenever the contract changes.
- Do not disable RLS, grant `PUBLIC`/`anon` privileged execution, or use the
  service role to bypass an authorization design problem.

## Development Process

1. Confirm the target is the configured non-production development project.
2. Inspect current migrations and live schema before writing a change.
3. Create a new migration with the Supabase CLI.
4. Iterate with direct development SQL only when necessary, then make the
   repository migration the reviewed source artifact.
5. Apply the final migration to development.
6. Inspect created objects, ownership, grants, policies, and hardened function
   configuration.
7. Regenerate or manually reconcile typed database contracts.
8. Run static migration tests and the opt-in live runtime security suite.
9. Record the migration and behavioral evidence in `DATA_MODEL`, affected
   architecture/security docs, `TESTING`, and `CHANGELOG`.

The current development project predates an enforced Supabase CLI migration
history ledger. Applied state has instead been verified through live object
inspection and runtime suites. Before any production deployment, reconcile the
repository version list with an explicit environment migration history and do
not assume repository presence alone proves application.

## Development Ledger

| Migration                                                                  | Development evidence                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260818113552_phase_2_auth_tenancy.sql`                                  | Applied; Phase 2 runtime tenancy/RLS verified                                                                                                                                                                                                  |
| `20260818140502_phase_3_business_onboarding.sql`                           | Applied; atomic onboarding runtime verified                                                                                                                                                                                                    |
| `20260818142125_phase_4_customer_management.sql`                           | Applied; customer RLS/archive runtime verified                                                                                                                                                                                                 |
| `20260818222232_phase_5_booking_engine.sql`                                | Applied; booking integrity/runtime verified                                                                                                                                                                                                    |
| `20260818230911_phase_6_secure_customer_confirmation_links.sql`            | Applied; confirmation capability runtime verified                                                                                                                                                                                              |
| `20260818234428_phase_7_fulfilment_operational_lifecycle.sql`              | Applied; lifecycle/reschedule runtime verified                                                                                                                                                                                                 |
| `20260819001954_phase_8_private_feedback_issues.sql`                       | Applied; feedback/issues runtime verified                                                                                                                                                                                                      |
| `20260819010145_phase_9_business_insights_analytics.sql`                   | Applied; analytics runtime verified                                                                                                                                                                                                            |
| `20260819011341_phase_9_fix_insights_current_time.sql`                     | Applied; analytics runtime verified                                                                                                                                                                                                            |
| `20260820030000_phase_9_fix_booking_trend_buckets.sql`                     | Applied; completion-bucket regression verified                                                                                                                                                                                                 |
| `20260820131919_customer_contact_confirmation_email_foundation.sql`        | Applied; contact/outbox runtime verified                                                                                                                                                                                                       |
| `20260820143032_inline_customer_booking_creation.sql`                      | Applied; atomic inline customer/booking runtime verified                                                                                                                                                                                       |
| `20260821125815_business_identity_logo_storage.sql`                        | Applied; website/logo columns, public logo bucket, owner policies, and confirmation identity inspected live                                                                                                                                    |
| `20260821132030_business_identity_runtime_fixes.sql`                       | Applied forward fix; removed RPC overload ambiguity, restored masked consumed-link email, all ten runtime suites passed                                                                                                                        |
| `20260823105232_trusted_confirmation_sharing.sql`                          | Applied; first-open idempotency, service-only grants, unauthorized denial, and Phase 6 runtime behavior verified                                                                                                                               |
| `20260823111107_trusted_confirmation_open_race_fix.sql`                    | Forward fix for delayed hydration after atomic confirmation; service-only grants and idempotency preserved                                                                                                                                     |
| `20260823120902_confirmed_booking_integrity_cancellation_notification.sql` | Applied; confirmed-term lock, awaiting-link invalidation, cancellation reason/outbox atomicity, recipient priority, and live race/security behavior verified                                                                                   |
| `20260823122133_cancellation_rpc_ambiguous_reference_fix.sql`              | Applied forward fix; qualified table-return column references after the first live cancellation attempt failed atomically; unchanged race scenario then passed                                                                                 |
| `20260823125121_booking_amendments_customer_reconfirmation.sql`            | Applied; amendment evidence/RLS/RPCs/outbox/lifecycle integration verified live                                                                                                                                                                |
| `20260823131218_booking_amendment_revocation_ambiguity_fix.sql`            | Applied forward diagnostic fix; replaced ambiguous revocation parameter references after the first live proposal rolled back                                                                                                                   |
| `20260823131332_booking_amendment_revocation_resolution_fix.sql`           | Applied forward fix; deterministic local parameter copies resolved SQL parsing and proposal/replacement then passed                                                                                                                            |
| `20260823131517_booking_amendment_email_idempotency_fix.sql`               | Applied forward fix; inferable nullable unique constraint made concurrent confirmation email creation atomic and idempotent                                                                                                                    |
| `20260823140111_booking_addons_customer_confirmation.sql`                  | Applied; add-on evidence, RLS/RPCs, purpose links, lifecycle/outbox/audit integration, and effective analytics verified live                                                                                                                   |
| `20260823141800_booking_addon_parent_currency_integrity.sql`               | Applied forward hardening; parent business and currency consistency now trigger-enforced on every insert/update                                                                                                                                |
| `20260823142231_booking_addon_email_idempotency_fix.sql`                   | Applied forward fix; regenerated request events coexist while confirmed-event uniqueness remains inferable and race-safe                                                                                                                       |
| `20260823151142_booking_integrity_consolidation.sql`                       | Removes four exact duplicate B-tree indexes while retaining equivalent query and uniqueness coverage                                                                                                                                           |
| `20260824094523_select_current_business_for_booking_creation.sql`          | Applied; exact active membership now authorizes explicit-business atomic booking creation; second-business write and cross-tenant denial verified live                                                                                         |
| `20260824100357_preserve_single_business_booking_compatibility.sql`        | Applied; legacy deployed caller remains available only for exactly one active membership and fails closed for multi-business accounts                                                                                                          |
| `20260824133925_trusted_feedback_sharing.sql`                              | Applied; feedback first-open column, truthful audit values, service-only idempotent open RPC, direct-role denial, and live Phase 8 behavior verified                                                                                           |
| `20260824223141_platform_admin_authorization_foundation.sql`               | Applied to the production-backed configured project; dedicated admin model, RLS/grants, self-scoped RPC, audit triggers, sole-admin bootstrap, and live authorization verified                                                                 |
| `20260825003000_platform_admin_read_only_overview.sql`                     | Applied to the production-backed configured project; aggregate-only active-admin overview RPC and exact runtime security verification passed                                                                                                   |
| `20260825003219_platform_admin_read_only_directories.sql`                  | Applied to the production-backed configured project; four narrow business/user directory/detail RPCs and production read-only verification passed                                                                                              |
| `20260825022135_platform_admin_read_only_booking_issue_operations.sql`     | Explicitly approved and applied transactionally to the production-backed project; ownership, grants, active/anonymous behavior, and real-data projections verified                                                                             |
| `20260825095217_platform_admin_read_only_email_operations.sql`             | Explicitly approved and applied transactionally; three functions, two authenticated execute grants, no domain or index changes; runtime authorization verified                                                                                 |
| `20260901090000_customer_safe_delete.sql`                                  | Exact approved SHA-256 `f510ca517ad6923eab555e86b5e716e2612cf0e5ecb92bb70ae584f1548fbc55`; applied to the configured production-backed project after rollback compile; owner/grant/search-path/index and unchanged-row catalog evidence passed |
| `20260901090010_booking_confirmation_request_event_type.sql`               | Exact approved mechanical enum split SHA-256 `9fc8ab1274a38dea2be13e2c34438073fcee6bab29f29650ff64146f4e9c81f3`; committed first to provide PostgreSQL's required enum boundary                                                                |
| `20260901090011_booking_confirmation_request_outbox.sql`                   | Exact approved SHA-256 `a5954bc6a5b6415617b263f81bc80d183072a73f98464e1a8472a34eb3ca216e`; applied after full rollback compile; exact-link outbox, grants, constraints, and unchanged-row catalog evidence passed                              |
| `20260901194500_delivery_feedback_automation.sql`                          | Exact approved SHA-256 `7ad964608538057bd041b745fa7005e7cb75a7e01264dade2a41ef48b8071ba7`; applied transactionally to the configured Production-backed database after Vault shape precheck; v0 preservation, v1 derivation, event/link association, grants, search paths, constraints, triggers, and unchanged historical counts passed |
| `20260901205018_delivery_feedback_legacy_compatibility.sql`                | Exact approved SHA-256 `183af91b911c97e77717a60f8f9f9c1f23e6432dffed2a1b88a4d8d6b44009bb`; applied transactionally as a temporary two-function Production rollout boundary; legacy/new rollback-only delivery, exact-one-event enforcement, strict non-null v1 association, forged-v1 and cross-tenant denial, hardened catalog, and zero residue passed |

The configured development project's historical CLI migration table remains
empty because this project predates enforced version tracking. These migrations
were applied directly through the configured development
database URL, matching the established development process above; live columns,
bucket configuration, policies, function grants/search paths, and runtime behavior
were then inspected. This does not remove the production requirement to reconcile
an explicit environment migration history before deployment.

## Production Deployment

Production deployment is not implemented by this pass. Before production:

- establish environment-specific applied-version tracking;
- back up and test restore procedures;
- apply migrations in order through an approved deployment identity;
- run post-apply object/grant checks and smoke/runtime verification;
- record the deployed versions and release evidence;
- stop deployment on drift or an unknown pre-existing object.

There are no destructive automatic down migrations. Prefer a reviewed forward
fix that preserves data. Rollback is an explicit operational decision using a
tested backup or a separately reviewed compensating migration.

## CI Boundary

The Tests job statically validates unique chronological migration filenames
through the governance test. Pull-request CI does not apply migrations to any
database. Live runtime suites assume the reviewed repository migrations were
already applied to their dedicated non-production target. Production migration
tracking, approval, application, and rollback remain a separate controlled
deployment process.

## 2026-08-24 Multi-Business Forward Migration

`20260824094523_select_current_business_for_booking_creation.sql` was created
with Supabase CLI 2.115.0 and applied transactionally to the configured
development database. It replaces the old first-membership booking RPC with an
explicit `p_business_id` contract and exact active-membership check. Static and
live tests verify an authorized second-business write, cross-tenant denial,
grants, and hardened search path. The development CLI ledger remains unreconciled
as documented above, so only this reviewed file was applied rather than
replaying historical migrations.

Because the initial Production app currently shares this database and still
uses the earlier RPC signature, the compatibility migration preserves that
signature only when the caller has exactly one active membership. It delegates
to the new explicit-business implementation. Multi-business legacy calls fail
with `explicit_business_required`, preventing ambiguous tenant writes during the
frontend deployment window.

## 2026-08-24 Platform Admin Foundation Migration

`20260824223141_platform_admin_authorization_foundation.sql` was created with
the Supabase CLI and applied as one transaction through the configured
production-backed database URL. It adds only the Phase 1 admin enums, table, RLS/grant
boundary, self-scoped active lookup, and authority-change audit trigger. No
index beyond the user UUID primary key was added because the table is tiny and
lookups are by that key. Live grant, role/status, self-promotion, vendor-owner,
disablement, audit, and route tests passed.

The current Vercel Production app uses this configured Supabase project. The
approved existing Auth UUID was bootstrapped as the sole active `SUPER_ADMIN` in
a reviewed transaction. Exactly one creation audit was verified, and a later
disable/re-enable round trip proved immediate route revocation and restoration.
No email address or credential is stored in authorization logic.

## 2026-08-25 Platform Admin Read-Only Overview Migration

`20260825003000_platform_admin_read_only_overview.sql` adds one stable,
aggregate-only `get_platform_admin_overview()` RPC. It uses an empty search path,
fully qualified relations, an active-`SUPER_ADMIN` caller check, authenticated-
only execute, and no table grant changes. It returns count fields and a server
timestamp only. The migration was applied transactionally to the configured
production-backed project; exact controlled deltas and denial paths passed.

## 2026-08-25 Platform Admin Read-Only Directories Migration

`20260825003219_platform_admin_read_only_directories.sql` adds a private active
admin assertion and four postgres-owned, stable, empty-search-path
`SECURITY DEFINER` RPCs for business list/detail and safe user list/detail.
Execution is revoked from PUBLIC/anonymous and available to authenticated callers
only behind each function's active-`SUPER_ADMIN` check. No table, enum, policy,
index, or domain relation changes. Auth tables receive no grants, and only
allowlisted account fields/provider names can leave the function.

The user explicitly approved application to the configured production-backed
project. The migration applied transactionally, ownership/grants matched the
contract, and Supabase DB lint returned no schema errors. Production-safe
read-only reconciliation verified exact directory/detail totals and projections.
No domain rows or existing platform authority were changed by that verification.

## 2026-08-25 Platform Admin Read-Only Booking And Issue Operations Migration

`20260825022135_platform_admin_read_only_booking_issue_operations.sql` reuses
the private active-admin assertion and adds no table, column, index, trigger,
write, or data mutation. It defines four minimized read projections, grants
invocation only to authenticated callers subject to the internal active-admin
check, and reloads the PostgREST schema cache. The configured project is
production-backed; the user explicitly approved this exact file and it applied
transactionally. Post-apply inspection confirmed postgres ownership, stable
security-definer execution, empty search paths, authenticated-only grants,
internal active-admin checks, and one unchanged active production admin.

## 2026-08-25 Platform Admin Read-Only Email Operations Migration

`20260825095217_platform_admin_read_only_email_operations.sql` adds three
functions: one private immutable failure classifier and two postgres-owned,
stable, empty-search-path `SECURITY DEFINER` read RPCs for a combined summary /
directory and minimized event detail. It revokes execution from PUBLIC,
anonymous, and authenticated before granting only the two public RPCs to
`authenticated`; both still assert active `SUPER_ADMIN` internally.

It adds no table, column, enum, policy, trigger, index, direct table grant, or
domain-data change. The user explicitly approved the file and it applied in one
transaction. Post-apply inspection confirmed postgres ownership, empty search
paths, authenticated-only public RPC grants, absent PUBLIC/anonymous grants,
unchanged eight outbox rows, and one unchanged active production admin.

## 2026-08-26 Admin Safe Failed-Email Retry Migration

`20260826004851_admin_safe_failed_email_retry.sql` was explicitly approved by
its SHA-256 and applied as one transaction to the configured production-backed
project. It adds provider-pinned `email_delivery_attempts`, three retry audit enum
values, a PENDING-only normal claim that records attempts, a service-role-only
atomic admin retry claim, atomic attempt finalization, and safe attempt evidence
on active-admin event detail.

The attempt table has RLS enabled and no anonymous/authenticated table grants.
Retry/finalize execute is service-role only; the read RPC remains authenticated
behind its internal active-admin check. Post-apply counts stayed at 19 email
events, zero attempts, and one active `SUPER_ADMIN`; the historical PENDING event
was not claimed or replayed. Controlled runtime fixtures were removed after
verification. No Docker/local Supabase was used.

## 2026-08-26 Booking Lifecycle And Payment Recording Migrations

`20260826095555_booking_lifecycle_payment_recording.sql` adds only the
`BOOKING_PAYMENT_RECORDED` audit enum value. The separately approved
`20260826095607_booking_lifecycle_payment_recording_schema.sql` adds the
append-only tenant `booking_payments` ledger, its composite booking foreign key,
positive safe-minor-unit and operation-id constraints, read-only member RLS,
supporting indexes, authoritative payment totals/recording functions, atomic
confirmation auto-activation, deterministic status-history ordering,
in-progress rescheduling support, and locked completion reconciliation.

Both exact approved files were applied enum-first to the configured
production-backed project. Post-apply catalog inspection confirmed postgres
ownership, RLS/grants, authenticated-only public RPC execution, empty search
paths, expected triggers/indexes/constraints, zero payment rows, no anonymous
authority, four unchanged legacy `CONFIRMED` rows, and unchanged delivered rows.
There was no existing-row rewrite, payment backfill, or historical paid-status
fabrication. Applied migration files must not be edited; any defect requires a
new approved forward fix.

PR #31 later passed all required CI and merged conflict-free as `c497d2e`.
Vercel deployed that exact `main` commit, and controlled desktop/mobile
production journeys exercised the approved confirmation and payment RPCs before
zero-fixture cleanup. The frozen migration hashes remained unchanged and no
forward-fix migration was required.

## Admin Phase 7 Read-Only Health RPCs

Migration `20260826195655_admin_phase_7_security_health.sql` was explicitly
approved and applied through the authenticated Supabase control plane on
2026-08-26. It adds only
`get_platform_admin_health_summary()` and
`get_platform_admin_security_activity(integer)`.

Both are stable, postgres-owned `SECURITY DEFINER` functions with empty
`search_path`, active-platform-admin assertions, no PUBLIC/anonymous execute,
and authenticated execute for the self-authorizing browser boundary. No table,
row, index, enum, RLS policy, or existing data changed. Catalog inspection,
active-admin reads, ordinary authenticated denial, and anonymous grant denial
passed. The migration does not send/retry/delete the preserved historical
pending email. Docker/local Supabase was not used.

## 2026-09-01 Customer Safe Delete And Initial Confirmation Request

The user explicitly approved all three exact files above, including the
mechanical enum split. The enum file committed first; the safe-delete and outbox
files then applied in one transaction to the configured production-backed
project. Post-apply inspection confirmed the new enum/audit values, postgres
ownership, empty `SECURITY DEFINER` search paths, authenticated-only intended
RPC execution, no PUBLIC/anonymous execute, and the exact partial unique index
for one confirmation-request event per link. Existing counts remained 30
customers, 33 bookings, 33 email events, and 46 confirmation links. No historical
recipient was rewritten and no historical request event was backfilled.

The migration corrects future customer-contact writes by trimming and
lowercasing only the domain, while preserving the mailbox/local part. It does
not change Supabase Auth identity semantics. The safe-delete RPC is owner-only,
locks and rechecks the tenant customer, rejects any booking history and catches
protected dependencies, and never cascades bookings.

Live mutation fixtures were not executed on this target: the environment safety
review rejected Auth/domain mutations, including rollback-only fixtures because
external Auth triggers may escape a PostgreSQL rollback. Repository/static tests
and rollback compile evidence therefore cover mutation behavior until the
guarded runtime suite can run against an explicitly safe dedicated dev/test
project. Applied migration files are immutable; any defect requires a separately
approved forward migration.
