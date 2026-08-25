import { describe, expect, it } from "vitest";
import {
  getAdminAttentionItems,
  parseAdminOverview,
} from "@/features/admin/overview";

const overviewFixture = {
  businesses: 2,
  platform_users: "3",
  customers: 4,
  bookings: 5,
  active_bookings: 3,
  due_today: 1,
  overdue: 2,
  completed: 1,
  open_issues: 1,
  email_pending: 2,
  email_sending: 1,
  email_sent: 7,
  email_failed: 3,
  refreshed_at: "2026-08-25T00:30:00.000Z",
};

describe("admin overview domain", () => {
  it("parses nonnegative aggregate counts without exposing row-level data", () => {
    const overview = parseAdminOverview(overviewFixture);

    expect(overview).toEqual({
      ...overviewFixture,
      platform_users: 3,
    });
    expect(Object.keys(overview ?? {})).not.toContain("recipient_email");
    expect(Object.keys(overview ?? {})).not.toContain("customer_name");
  });

  it("rejects missing, negative, or unsafe aggregate values", () => {
    expect(parseAdminOverview({ ...overviewFixture, customers: -1 })).toBeNull();
    expect(
      parseAdminOverview({
        ...overviewFixture,
        bookings: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBeNull();
    expect(parseAdminOverview({ ...overviewFixture, email_failed: undefined })).toBeNull();
  });

  it("derives the three implemented attention categories", () => {
    const overview = parseAdminOverview(overviewFixture);
    expect(overview).not.toBeNull();

    expect(getAdminAttentionItems(overview!)).toEqual([
      expect.objectContaining({ label: "Failed emails", value: 3 }),
      expect.objectContaining({ label: "Open booking issues", value: 1 }),
      expect.objectContaining({ label: "Overdue bookings", value: 2 }),
    ]);
  });
});
