import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_PAGE_SIZE,
  describeAdminEmailDeliveryConfiguration,
  formatEmailFailureCategory,
  getAdminEmailHealth,
  parseAdminEmailEventDetail,
  parseAdminEmailOperationsPage,
  parseAdminEmailParams,
} from "@/features/admin/email-operations";

const businessId = "11111111-1111-4111-8111-111111111111";
const bookingId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-08-25T08:30:00.000Z";
const business = { id: businessId, name: "Operations Studio", slug: "operations-studio" };
const booking = { id: bookingId, reference: "MK-000001", title: "Controlled booking" };
const event = {
  id: eventId,
  event_type: "BOOKING_CONFIRMED",
  status: "SENT",
  business,
  booking,
  attempt_count: "1",
  created_at: createdAt,
  last_attempt_at: createdAt,
  sent_at: createdAt,
};
const summary = {
  total: "4",
  pending: "1",
  sending: "1",
  sent: "1",
  failed: "1",
  potentially_stuck: "1",
  range: "7d",
  range_start: "2026-08-18T08:30:00.000Z",
  refreshed_at: createdAt,
};

describe("platform admin email operation response boundaries", () => {
  it("normalizes bounded presets, filters, context, and punctuation search", () => {
    expect(
      parseAdminEmailParams({
        q: "  MK %_,.'\"()  ",
        page: ["2", "4"],
        status: "FAILED",
        eventType: "BOOKING_ADDON_CONFIRMED",
        range: "30d",
        business: businessId,
        booking: bookingId,
      }),
    ).toEqual({
      q: "MK %_,.'\"()",
      page: 2,
      status: "FAILED",
      eventType: "BOOKING_ADDON_CONFIRMED",
      range: "30d",
      businessId,
      bookingId,
    });

    expect(
      parseAdminEmailParams({
        q: "x".repeat(100),
        page: "1 OR 1=1",
        status: "DELIVERED",
        eventType: "OPENED",
        range: "365d",
        business: "invalid",
      }),
    ).toEqual({
      q: "x".repeat(80),
      page: 1,
      status: "all",
      eventType: "all",
      range: "7d",
      businessId: undefined,
      bookingId: undefined,
    });
  });

  it("parses exact summary counts and computes stable pagination", () => {
    const result = parseAdminEmailOperationsPage({
      summary,
      event_types: [{ event_type: "BOOKING_CONFIRMED", count: "3", failed: "1" }],
      items: [event],
      page: 2,
      page_size: ADMIN_EMAIL_PAGE_SIZE,
      total: "41",
    });

    expect(result?.summary).toMatchObject({
      total: 4,
      pending: 1,
      sending: 1,
      sent: 1,
      failed: 1,
    });
    expect(result?.totalPages).toBe(3);
    expect(result?.items[0]?.attempt_count).toBe(1);
  });

  it("keeps recipient and failure classification detail-only", () => {
    expect(
      parseAdminEmailEventDetail({
        ...event,
        status: "FAILED",
        sent_at: null,
        recipient_masked: "o***@example.com",
        failure_category: "rate_limited",
      }),
    ).not.toBeNull();

    expect(
      parseAdminEmailOperationsPage({
        summary,
        event_types: [],
        items: [{ ...event, recipient_masked: "o***@example.com" }],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    ).toBeNull();

    expect(
      parseAdminEmailEventDetail({
        ...event,
        recipient_masked: "o***@example.com",
        failure_category: null,
        provider_message_id: "must-not-cross-boundary",
      }),
    ).toBeNull();
  });

  it("derives health from failed and aged outbox counts", () => {
    const parsed = parseAdminEmailOperationsPage({
      summary,
      event_types: [],
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });
    expect(getAdminEmailHealth(parsed!.summary).status).toBe("Attention");
    expect(getAdminEmailHealth({ ...parsed!.summary, failed: 0 }).status).toBe("Backlog");
    expect(
      getAdminEmailHealth({
        ...parsed!.summary,
        failed: 0,
        potentially_stuck: 0,
      }).status,
    ).toBe("Healthy");
  });

  it("formats only controlled failure categories", () => {
    expect(formatEmailFailureCategory("provider_rejected")).toBe("Provider Rejected");
    expect(formatEmailFailureCategory(null)).toBe("No failure recorded");
  });

  it("reports provider configuration without overstating recipient delivery", () => {
    expect(
      describeAdminEmailDeliveryConfiguration({
        label: "Brevo",
        external: true,
        configured: true,
      }),
    ).toEqual({
      status: "configured",
      provider: "Brevo",
      label: "External delivery configured — Brevo",
      description:
        "Sent means the configured provider accepted the request; delivery, opening, and reading are not tracked.",
    });

    expect(
      describeAdminEmailDeliveryConfiguration({
        label: "Brevo",
        external: true,
        configured: false,
      }),
    ).toMatchObject({ status: "incomplete", provider: "Brevo" });

    expect(
      describeAdminEmailDeliveryConfiguration({
        label: "Development",
        external: false,
        configured: true,
      }),
    ).toMatchObject({ status: "development", provider: "Development" });
  });
});
