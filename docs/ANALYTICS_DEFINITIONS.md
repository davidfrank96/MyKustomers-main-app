# Analytics Definitions

Phase 9 analytics are private business insights derived from stored tenant
records. They are not public reports, forecasts, or accounting statements.

## Date Model

Analytics date ranges use UTC calendar boundaries against PostgreSQL
`timestamptz` values.

Supported ranges:

- This month.
- Last month.
- Last 30 days.
- This year.
- Custom range up to five years.

Previous-period comparison uses the immediately preceding equivalent duration.
If the previous value is zero and the current value is positive, the UI shows
`New activity` rather than an infinite percentage.

## Booking Inclusion

`DRAFT` bookings are included in `Bookings created` only. They do not count
toward recorded value, completed value, average booking value, deposits, new
customer, returning customer, or repeat-rate calculations.

`AWAITING_CUSTOMER`, `CONFIRMED`, `IN_PROGRESS`, `READY`, `DELIVERED`, and
`COMPLETED` are qualifying statuses for customer activity and recorded value.

`CANCELLED` bookings are included in booking counts and cancellation rate, but
not in recorded or completed value.

`COMPLETED` bookings drive completed count, completed booking value, on-time
rate, and fulfilment duration.

Only `CONFIRMED` booking add-ons contribute value. `DRAFT`,
`AWAITING_CUSTOMER`, and `CANCELLED` add-ons contribute zero. Confirmed add-ons
inherit the parent booking currency and are attributed to the parent booking's
existing metric period; they never create another booking count.

## Financial Terminology

My Customers does not process vendor/customer payments. Values are recorded
booking amounts, not independently verified revenue, cash received, profit, tax,
or accounting balances.

Currency values are grouped by booking currency. Phase 9 never sums NGN, EUR,
GBP, and USD into one total and does not perform foreign-exchange conversion.

Three definitions must remain distinct:

- Booking value: canonical booking total plus confirmed add-on totals.
- Payments recorded: initial booking deposit plus confirmed add-on deposits plus
  subsequent append-only `booking_payments`.
- Outstanding: `max(booking value - payments recorded, 0)`.

The existing Phase 9 `Recorded deposits` metric remains an agreed-deposit metric
for its historical date/status policy; it is not silently reinterpreted as all
payments received. Booking detail exposes authoritative current payments and
outstanding. A future cross-booking payments/outstanding insight requires a
separately reviewed database aggregation and date/legacy policy. Historical
completion does not imply paid in full, and no payment rows are fabricated.

## Metric Formulas

- Total active customers: count of customer records for the business where
  `archived_at is null`.
- New customers: customers whose first qualifying booking was created during
  the selected period.
- Returning customers: customers with at least one qualifying booking created
  during the selected period and at least two lifetime qualifying bookings.
- Repeat customer rate: returning customers divided by customers with at least
  one qualifying booking created during the selected period.
- Bookings created: all bookings created during the selected period.
- Completed bookings: bookings currently `COMPLETED` with `completed_at` during
  the selected period.
- Cancelled bookings: bookings currently `CANCELLED` with `cancelled_at` during
  the selected period.
- Active bookings: current bookings whose status is not `COMPLETED` or
  `CANCELLED`, independent of period.
- Recorded booking value: sum of each qualifying booking's
  `total_amount_minor` plus all confirmed add-on totals, for non-`DRAFT`,
  non-`CANCELLED` bookings created during the selected period, grouped by currency.
- Completed booking value: sum of each completed booking's
  `total_amount_minor` plus all confirmed add-on totals, for bookings with
  `completed_at` during the selected period, grouped by currency.
- Average booking value: recorded booking value divided by recorded booking
  count for the same currency.
- Recorded deposits: sum of each qualifying booking's `deposit_amount_minor`
  plus all confirmed add-on deposits, for non-`DRAFT`, non-`CANCELLED` bookings
  created during the selected period, grouped by currency.
- On-time rate: completed bookings with `delivered_at <= scheduled_for` divided
  by completed bookings with both `scheduled_for` and `delivered_at`. The period
  is based on `completed_at`. Rescheduled bookings use the current agreed
  `scheduled_for`.
- Overdue bookings: current bookings with `scheduled_for` before the current
  time and status not in `DELIVERED`, `COMPLETED`, or `CANCELLED`.
- Cancellation rate: cancelled bookings divided by completed plus cancelled
  bookings in the selected period.
- Average fulfilment duration: average minutes between `started_at` and
  `completed_at` for completed bookings in the selected period.
- Feedback responses: submitted feedback rows where `submitted_at` is during
  the selected period.
- Average rating: average `overall_rating` from submitted private feedback.
- Feedback on-time percentage: feedback rows where `on_time = true` divided by
  feedback responses.
- Met-expectations percentage: feedback rows where `met_expectations = true`
  divided by feedback responses.
- Issues opened: booking issues with `created_at` during the selected period.
- Issues resolved: booking issues with `resolved_at` during the selected period.
- Issue resolution rate: issues opened during the selected period that are
  currently `RESOLVED` divided by issues opened during the selected period.
- Issue categories: count of issues opened during the selected period grouped
  by category.
