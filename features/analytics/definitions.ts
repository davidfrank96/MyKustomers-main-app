export const analyticsDefinitions = [
  {
    metric: "Total active customers",
    formula: "Count of customer records for the business where archived_at is null.",
  },
  {
    metric: "New customers",
    formula:
      "Customers whose first qualifying booking was created during the selected period. Qualifying bookings exclude DRAFT and CANCELLED.",
  },
  {
    metric: "Returning customers",
    formula:
      "Customers with at least one qualifying booking created during the period and at least two lifetime qualifying bookings for the same saved customer record.",
  },
  {
    metric: "Repeat customer rate",
    formula:
      "Returning customers divided by customers with at least one qualifying booking created during the period.",
  },
  {
    metric: "Bookings created",
    formula: "All bookings created during the selected period, including DRAFT and CANCELLED.",
  },
  {
    metric: "Completed bookings",
    formula: "Bookings currently COMPLETED with completed_at during the selected period.",
  },
  {
    metric: "Cancelled bookings",
    formula: "Bookings currently CANCELLED with cancelled_at during the selected period.",
  },
  {
    metric: "Active bookings",
    formula: "Current bookings whose status is not COMPLETED or CANCELLED, independent of period.",
  },
  {
    metric: "Recorded booking value",
    formula:
      "Sum of total_amount_minor for non-DRAFT, non-CANCELLED bookings created during the selected period, grouped by currency.",
  },
  {
    metric: "Completed booking value",
    formula:
      "Sum of total_amount_minor for COMPLETED bookings with completed_at during the selected period, grouped by currency.",
  },
  {
    metric: "Average booking value",
    formula:
      "Recorded booking value divided by recorded non-DRAFT, non-CANCELLED booking count for the same currency.",
  },
  {
    metric: "Recorded deposits",
    formula:
      "Sum of deposit_amount_minor for non-DRAFT, non-CANCELLED bookings created during the selected period, grouped by currency.",
  },
  {
    metric: "On-time rate",
    formula:
      "Completed bookings with delivered_at <= current scheduled_for divided by completed bookings with scheduled_for and delivered_at. The period is based on completed_at.",
  },
  {
    metric: "Overdue bookings",
    formula:
      "Current bookings with scheduled_for before the current time and status not in DELIVERED, COMPLETED, or CANCELLED.",
  },
  {
    metric: "Cancellation rate",
    formula:
      "Cancelled bookings divided by completed plus cancelled bookings in the selected period. Completed uses completed_at; cancelled uses cancelled_at.",
  },
  {
    metric: "Average fulfilment duration",
    formula:
      "Average minutes between started_at and completed_at for completed bookings in the selected period.",
  },
  {
    metric: "Feedback responses",
    formula: "Count of submitted private feedback rows where submitted_at is during the selected period.",
  },
  {
    metric: "Average rating",
    formula: "Average of submitted feedback overall_rating during the selected period.",
  },
  {
    metric: "Feedback on-time percentage",
    formula: "Submitted feedback rows where on_time is true divided by submitted feedback rows.",
  },
  {
    metric: "Met-expectations percentage",
    formula:
      "Submitted feedback rows where met_expectations is true divided by submitted feedback rows.",
  },
  {
    metric: "Issues opened",
    formula: "Booking issues with created_at during the selected period.",
  },
  {
    metric: "Issues resolved",
    formula: "Booking issues with resolved_at during the selected period.",
  },
  {
    metric: "Issue resolution rate",
    formula: "Issues opened during the selected period that are currently RESOLVED divided by issues opened during the selected period.",
  },
  {
    metric: "Issue categories",
    formula: "Count of booking issues opened during the selected period, grouped by category.",
  },
] as const;

export const analyticsFinancialTerminology =
  "Values are recorded booking amounts, not independently verified revenue, cash received, profit, tax, or accounting balances. Multi-currency values are always grouped by currency and are never summed across currencies.";
