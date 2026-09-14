# Notification retention correction — approved and applied

Status: APPROVED AND APPLIED on 2026-09-14 after the user’s explicit “yes proceed”.
Migration: `20260914020434_notification_read_retention.sql`; SHA-256:
`cc3a4d7e45dc265c6666a42b5bf10db60ef063eec332ff2bf5b2ed5c43e33d99`.
The text below preserves the reviewed proposal and approval rationale.

The live catalog on 2026-09-14 confirms `read_at timestamptz` exists. However,
`maintain_notifications(integer)` currently deletes every notification older than
90 days by `created_at`, including unread rows. The application service role has
neither SELECT nor DELETE on this table. Skipping that function would abandon
existing private delivery/device and revoked-membership cleanup. Direct client
deletion would require broader grants and weaken the current architecture.

The complete [SQL proposal](notification-read-retention.sql) changes only:

- one partial index on `(read_at, id)` for non-null read timestamps;
- the existing service-only maintenance function's notification-history predicate
  to `read_at < now() - interval '72 hours'`, ordered by `read_at, id` and retaining
  the existing bounded limit. No other cleanup predicate changes.

No columns, tables, RLS policies, grants, scheduler objects, cadence, providers,
environment values, or dependencies change. Existing overdue receipts remain
independent of deleted history. Lock acquisition is capped at 3 seconds and the
migration statement timeout is 15 seconds; a failure rolls the transaction back.
The index is additive so rollback does not require rebuilding an old index.

The application list will retain unread or `read_at >= cutoff`, including at
exactly 72 hours. The existing worker will call maintenance only on UTC minutes
0, 15, 30 and 45, after overdue generation and push processing. The scheduler
remains ACTIVE, every minute; ordinary generation/delivery cadence is unchanged.
Each cleanup opportunity remains capped at 1,000 rows per existing category;
repeated authorized invocations are idempotent. No new worker or scheduler.

Local disposable PostgreSQL verification passed: 30/120-day unread retained,
71-hour and exactly 72-hour read retained, 73-hour read omitted/deleted, one-row
batch bound, repeated cleanup, first-read preservation, mark-all user isolation,
unchanged denied direct-delete and anonymous function access, plus the existing
foundation and concurrent lease tests. No cloud fixture or notification was used.

Approval was required because the user brief explicitly requires no unapproved
migration and expected zero database changes with an existing `read_at`. This
unexpected existing cleanup function makes that expectation incompatible with
the requested unread-retention guarantee. Upon approval, create the migration
with the repository's Supabase CLI workflow, validate exact catalog drift and
row/index size, apply only this transaction, and verify catalog and scheduler
state. Never restore the old age-only deletion rule as an application rollback.

The approved migration applied in one guarded transaction after exact function drift checks. Post-apply: valid/ready partial index, postgres ownership, empty search path, service-only execution, no direct delete grant; scheduler ACTIVE/every minute and 15/15 recent scheduler invocations succeeded. No manual cleanup of legitimate history was used. Application release is tracked in the Golden Stability report.

Read-only pre-application sizing: notification heap 8,192 bytes, estimated 14 rows. Scheduler rechecked ACTIVE/every minute after the full local E2E run. The approved transaction is now applied; this sizing was the pre-application snapshot.
