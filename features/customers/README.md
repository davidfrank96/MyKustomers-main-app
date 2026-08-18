# Customers Feature

Phase 4 implements tenant-scoped customer records for businesses.

Customers are business-owned records, not platform accounts. They are not
Supabase Auth users, do not have passwords, and are not members of
`business_members`.

Customer access is controlled by the `customers.business_id` relationship,
server-side membership checks, and PostgreSQL RLS. Ordinary UI deletion is
implemented as archiving through `archived_at`; hard deletion is deferred to a
future privacy/account-deletion design.
