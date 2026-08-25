import { describe, expect, it } from "vitest";
import {
  ADMIN_OPERATION_PAGE_SIZE,
  formatOperationLabel,
  parseAdminBookingDetail,
  parseAdminBookingPage,
  parseAdminBookingParams,
  parseAdminIssueDetail,
  parseAdminIssuePage,
  parseAdminIssueParams,
} from "@/features/admin/operations";

const businessId = "11111111-1111-4111-8111-111111111111";
const bookingId = "22222222-2222-4222-8222-222222222222";
const issueId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const createdAt = "2026-08-25T08:30:00.000Z";
const business = { id: businessId, name: "Operations Studio", slug: "operations-studio" };

const bookingSummary = {
  id: bookingId,
  reference: "MK-000001",
  title: "Controlled booking",
  business,
  customer_name: "Controlled customer",
  status: "CONFIRMED",
  scheduled_for: createdAt,
  currency: "NGN",
  effective_total_amount_minor: 73000,
  created_at: createdAt,
  open_issue_count: "1",
};

const issueSummary = {
  id: issueId,
  category: "LATE_DELIVERY",
  status: "OPEN",
  business,
  booking: { id: bookingId, reference: "MK-000001", title: "Controlled booking" },
  created_at: createdAt,
  resolved_at: null,
};

const identity = { id: userId, display_name: "Operator", email: "operator@example.com" };

describe("platform admin operation response boundaries", () => {
  it("normalizes booking search, filters, business scope, and pagination", () => {
    expect(
      parseAdminBookingParams({
        q: "  MK %_,.'\"()  ",
        page: "2",
        filter: "overdue",
        business: businessId,
      }),
    ).toEqual({
      q: "MK %_,.'\"()",
      page: 2,
      filter: "overdue",
      businessId,
    });
    expect(
      parseAdminBookingParams({ q: "x".repeat(100), page: "1 OR 1=1", filter: "DROP" }),
    ).toEqual({
      q: "x".repeat(80),
      page: 1,
      filter: "all",
      businessId: undefined,
    });
  });

  it("normalizes issue filters against the authoritative values", () => {
    expect(
      parseAdminIssueParams({
        q: "%_()",
        status: "OPEN",
        category: "NO_SHOW",
        business: businessId,
        page: ["3", "4"],
      }),
    ).toEqual({ q: "%_()", status: "OPEN", category: "NO_SHOW", businessId, page: 3 });
    expect(parseAdminIssueParams({ status: "open", category: "invented" })).toEqual({
      q: "",
      status: "all",
      category: "all",
      businessId: undefined,
      page: 1,
    });
  });

  it("parses booking and issue pages with safe counts", () => {
    const bookings = parseAdminBookingPage({
      items: [bookingSummary],
      page: 2,
      page_size: ADMIN_OPERATION_PAGE_SIZE,
      total: "41",
    });
    expect(bookings?.totalPages).toBe(3);
    expect(bookings?.items[0]?.open_issue_count).toBe(1);

    const issues = parseAdminIssuePage({
      items: [issueSummary],
      page: 1,
      page_size: 20,
      total: 1,
    });
    expect("description" in (issues?.items[0] ?? {})).toBe(false);
  });

  it("parses the minimized operational booking snapshot", () => {
    const { customer_name: customerName, open_issue_count: openIssueCount, ...booking } =
      bookingSummary;
    expect(openIssueCount).toBe("1");
    const detail = parseAdminBookingDetail({
      ...booking,
      customer: { name: customerName },
      creator: identity,
      canonical_total_amount_minor: 55000,
      canonical_deposit_amount_minor: 10000,
      effective_deposit_amount_minor: 15000,
      started_at: null,
      ready_at: null,
      delivered_at: null,
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      confirmation: {
        state: "confirmed",
        confirmed_at: createdAt,
        contact_email_masked: "o***@example.com",
        contact_phone_masked: "***0199",
        terms: {
          title: "Controlled booking",
          currency: "NGN",
          total_amount_minor: 55000,
          deposit_amount_minor: 10000,
        },
      },
      amendments: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          status: "CONFIRMED",
          reason: "Customer-approved scope",
          changed_fields: ["title", "total_amount_minor"],
          created_at: createdAt,
          submitted_at: createdAt,
          first_opened_at: createdAt,
          confirmed_at: createdAt,
          revoked_at: null,
          revoked_reason: null,
        },
      ],
      addons: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          title: "Confirmed add-on",
          status: "CONFIRMED",
          currency: "NGN",
          total_amount_minor: 18000,
          deposit_amount_minor: 5000,
          created_at: createdAt,
          submitted_at: createdAt,
          confirmed_at: createdAt,
          cancelled_at: null,
          cancellation_reason: null,
        },
      ],
      status_history: [
        { from_status: "AWAITING_CUSTOMER", to_status: "CONFIRMED", changed_at: createdAt },
      ],
      changes: [
        {
          change_type: "amendment",
          previous_scheduled_for: null,
          new_scheduled_for: null,
          changed_fields: ["title", "total_amount_minor"],
          created_at: createdAt,
        },
      ],
      feedback: { overall_rating: 5, on_time: true, met_expectations: true, submitted_at: createdAt },
      issues: [{ id: issueId, category: "LATE_DELIVERY", status: "OPEN", created_at: createdAt, resolved_at: null }],
      email_summary: [{ event_type: "BOOKING_CONFIRMED", status: "SENT", count: "1" }],
    });

    expect(detail?.effective_total_amount_minor).toBe(73000);
    expect(detail?.amendments[0]?.changed_fields).toEqual(["title", "total_amount_minor"]);
    expect(detail?.feedback).toEqual({ overall_rating: 5, on_time: true, met_expectations: true, submitted_at: createdAt });
  });

  it("parses authorized issue detail but rejects privileged payload expansion", () => {
    expect(
      parseAdminIssueDetail({
        ...issueSummary,
        description: "Controlled private issue context",
        booking: { ...issueSummary.booking, status: "CONFIRMED" },
        creator: identity,
        resolver: null,
      }),
    ).not.toBeNull();

    expect(
      parseAdminBookingPage({
        items: [{ ...bookingSummary, internal_notes: "must not cross boundary" }],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    ).toBeNull();
    expect(
      parseAdminIssuePage({
        items: [{ ...issueSummary, description: "must stay on detail" }],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    ).toBeNull();
  });

  it("formats persisted enum values for text-backed UI", () => {
    expect(formatOperationLabel("AWAITING_CUSTOMER")).toBe("Awaiting Customer");
    expect(formatOperationLabel("PAYMENT_BALANCE_ISSUE")).toBe("Payment Balance Issue");
  });
});
