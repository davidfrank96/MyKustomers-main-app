# Database

The application schema is implemented in the configured development Supabase
project. It includes tenant profiles, businesses and memberships, customers,
bookings and lifecycle evidence, secure public-link records, private feedback,
operational issues, audit events, rate-limit buckets, and the transactional
email outbox.

All repository migrations live in `supabase/migrations`. The conceptual and
implemented model is documented in `docs/DATA_MODEL.md`; migration discipline
and the development ledger are in `docs/MIGRATIONS.md`. Documentation is not
implementation evidence.

Every database change requires a new reviewed migration. Applied migrations are
immutable. Tenant-owned tables exposed through Supabase must use PostgreSQL Row
Level Security with membership-based ownership checks. Policies and narrow RPCs
must authorize the specific row being accessed; frontend filtering is never
authorization.

Do not add permissive policies, disable RLS, or expose service-role credentials
to browser code.
