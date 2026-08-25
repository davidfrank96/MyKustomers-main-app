import { z } from "zod";

const aggregateCount = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value) && value >= 0, {
    message: "Aggregate count is outside the supported range.",
  });

const adminOverviewSchema = z.object({
  businesses: aggregateCount,
  platform_users: aggregateCount,
  customers: aggregateCount,
  bookings: aggregateCount,
  active_bookings: aggregateCount,
  due_today: aggregateCount,
  overdue: aggregateCount,
  completed: aggregateCount,
  open_issues: aggregateCount,
  email_pending: aggregateCount,
  email_sending: aggregateCount,
  email_sent: aggregateCount,
  email_failed: aggregateCount,
  refreshed_at: z.string().datetime({ offset: true }),
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export function parseAdminOverview(value: unknown): AdminOverview | null {
  const result = adminOverviewSchema.safeParse(value);
  return result.success ? result.data : null;
}

export type AdminAttentionItem = {
  label: string;
  value: number;
  description: string;
};

export function getAdminAttentionItems(
  overview: AdminOverview,
): AdminAttentionItem[] {
  return [
    {
      label: "Failed emails",
      value: overview.email_failed,
      description: "Outbox events that need delivery investigation.",
    },
    {
      label: "Open booking issues",
      value: overview.open_issues,
      description: "Operational issues that have not been resolved.",
    },
    {
      label: "Overdue bookings",
      value: overview.overdue,
      description: "Past-due bookings that have not reached delivery.",
    },
  ];
}
