# Analytics Feature

Phase 9 implements private business insights derived from persisted tenant
records.

## Scope

- Authenticated `/insights` page.
- Dashboard monthly insights summary.
- Date ranges: this month, last month, last 30 days, this year, and validated
  custom ranges.
- Customer, booking, recorded/completed value, operational, feedback, and issue
  metrics.
- Previous equivalent period comparisons.

## Data Access

Analytics are fetched through `public.get_business_insights`, an authenticated
Supabase RPC that checks active business membership and returns aggregate JSON.
The feature does not add analytics tables, materialized views, public reports,
exports, billing analytics, forecasting, or AI recommendations.

## Financial Wording

Value metrics use recorded booking value and completed booking value. They are
not revenue, cash received, profit, tax, payment settlement, or accounting
figures. Currency values remain grouped by booking currency and are never
summed across currencies.

Metric formulas are documented in `docs/ANALYTICS_DEFINITIONS.md` and mirrored
in `definitions.ts` for the in-app definitions section.

Phase C effective value includes all confirmed add-on totals and recorded
deposits on the parent booking. Draft, awaiting, and cancelled add-ons are
excluded, currencies remain inherited/grouped, and add-ons never increase the
booking count denominator.

Phase 9.5 keeps insights readable for business owners by avoiding internal
tenancy terminology in visible definitions and preserving conservative recorded
value language.

## Dashboard Navigation

Dashboard summary links preserve existing query contracts:

- Business identity -> `/business`.
- Total customers -> `/customers`.
- Active bookings -> `/bookings?filter=active`.
- Due today -> `/bookings?filter=today`.
- Overdue -> `/bookings?filter=overdue`.
- Completed count/value and feedback this month -> `/insights?range=this_month`.

`active` is an explicit booking-list filter for statuses other than `COMPLETED`
and `CANCELLED`, matching the existing dashboard metric. No new metric was
introduced.
