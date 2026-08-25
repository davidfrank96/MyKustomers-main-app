import { z } from "zod";

export const adminCountSchema = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value) && value >= 0, {
    message: "Aggregate count is outside the supported range.",
  });

const adminOverviewSchema = z.object({
  businesses: adminCountSchema,
  platform_users: adminCountSchema,
  customers: adminCountSchema,
  bookings: adminCountSchema,
  active_bookings: adminCountSchema,
  due_today: adminCountSchema,
  overdue: adminCountSchema,
  completed: adminCountSchema,
  open_issues: adminCountSchema,
  email_pending: adminCountSchema,
  email_sending: adminCountSchema,
  email_sent: adminCountSchema,
  email_failed: adminCountSchema,
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
