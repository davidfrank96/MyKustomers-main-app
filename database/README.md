# Database

No application tables are created in Phase 1 or Phase 1.5.

The planned conceptual model lives in `docs/DATA_MODEL.md`. Phase 2 Supabase
migrations now live in `supabase/migrations/`. Documentation is not
implementation evidence.

Future database work must be added through reviewed migrations in
`database/migrations` or the selected Supabase migration workflow. Every
multi-tenant table exposed through Supabase must use PostgreSQL Row Level
Security with `business_id` ownership checks. Policies must authorize the
specific row being accessed; frontend filtering is never authorization.

Do not add permissive policies, disable RLS, or expose service-role credentials
to browser code.
