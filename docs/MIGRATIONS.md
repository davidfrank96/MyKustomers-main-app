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

| Migration | Development evidence |
| --- | --- |
| `20260818113552_phase_2_auth_tenancy.sql` | Applied; Phase 2 runtime tenancy/RLS verified |
| `20260818140502_phase_3_business_onboarding.sql` | Applied; atomic onboarding runtime verified |
| `20260818142125_phase_4_customer_management.sql` | Applied; customer RLS/archive runtime verified |
| `20260818222232_phase_5_booking_engine.sql` | Applied; booking integrity/runtime verified |
| `20260818230911_phase_6_secure_customer_confirmation_links.sql` | Applied; confirmation capability runtime verified |
| `20260818234428_phase_7_fulfilment_operational_lifecycle.sql` | Applied; lifecycle/reschedule runtime verified |
| `20260819001954_phase_8_private_feedback_issues.sql` | Applied; feedback/issues runtime verified |
| `20260819010145_phase_9_business_insights_analytics.sql` | Applied; analytics runtime verified |
| `20260819011341_phase_9_fix_insights_current_time.sql` | Applied; analytics runtime verified |
| `20260820030000_phase_9_fix_booking_trend_buckets.sql` | Applied; completion-bucket regression verified |
| `20260820131919_customer_contact_confirmation_email_foundation.sql` | Applied; contact/outbox runtime verified |
| `20260820143032_inline_customer_booking_creation.sql` | Applied; atomic inline customer/booking runtime verified |
| `20260821125815_business_identity_logo_storage.sql` | Applied; website/logo columns, public logo bucket, owner policies, and confirmation identity inspected live |
| `20260821132030_business_identity_runtime_fixes.sql` | Applied forward fix; removed RPC overload ambiguity, restored masked consumed-link email, all ten runtime suites passed |

The configured development project's historical CLI migration table remains
empty because this project predates enforced version tracking. These two
migrations were applied directly through the configured development database
URL, matching the established development process above; live columns, bucket
configuration, policies, function grants/search paths, and runtime behavior were
then inspected. This does not remove the production requirement to reconcile an
explicit environment migration history before deployment.

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
