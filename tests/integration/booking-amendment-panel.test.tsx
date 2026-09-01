import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import { BookingAmendmentPanel } from "@/components/forms/booking-amendment-panel";
import type { BookingAmendmentSummary } from "@/features/amendments/queries";

const emptySummary: BookingAmendmentSummary = {
  latest: null,
  history: [],
  displayStatus: "none",
  requestEmailStatus: null,
  confirmationEmailStatus: null,
  sharedAt: null,
  shareMethod: null,
};

const initialValues = {
  title: "Website redesign",
  description: "Agreed website scope",
  currency: "NGN" as const,
  totalAmount: "50000",
  depositAmount: "10000",
  scheduledFor: "2026-09-01T10:00:00.000Z",
};

const createAction = vi.fn(async () => ({ status: "idle" as const }));
const revokeAction = vi.fn(async () => ({ status: "idle" as const }));
const recordShareAction = vi.fn(async () => undefined);

function renderPanel({
  summary = emptySummary,
  canPropose = false,
}: {
  summary?: BookingAmendmentSummary;
  canPropose?: boolean;
} = {}) {
  return render(
    <BookingDetailSection
      id="booking-changes"
      title="Booking changes"
      summary={summary.history.length === 0 ? "No changes" : "1 change request"}
      icon="changes"
      defaultOpen
    >
      <BookingAmendmentPanel
        summary={summary}
        canPropose={canPropose}
        businessName="Example Business"
        customerName="Ada"
        initialValues={initialValues}
        createAction={createAction}
        revokeAction={revokeAction}
        recordShareAction={recordShareAction}
      />
    </BookingDetailSection>,
  );
}

describe("booking amendment panel presentation", () => {
  it("renders the compact no-change explanation inside the existing accordion", () => {
    renderPanel();

    const trigger = screen.getByRole("button", { name: /Booking changes/ });
    expect(trigger).toHaveTextContent("No changes");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Booking changes can be proposed only while a confirmed booking is confirmed or in progress.",
    );

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("note", { hidden: true })).not.toBeVisible();
  });

  it("preserves the existing propose-change action when the booking is eligible", () => {
    renderPanel({ canPropose: true });

    expect(screen.getByRole("button", { name: "Propose change" })).toBeVisible();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("keeps pending amendment evidence visible", () => {
    const pending = {
      id: "11111111-1111-4111-8111-111111111111",
      business_id: "22222222-2222-4222-8222-222222222222",
      booking_id: "33333333-3333-4333-8333-333333333333",
      status: "PENDING_CUSTOMER" as const,
      purpose: "BOOKING_AMENDMENT",
      token_hash: "controlled-hash",
      expires_at: "2026-09-02T10:00:00.000Z",
      reason: "Customer requested a larger scope.",
      base_terms_hash: "base-hash",
      old_terms: {
        title: "Website redesign",
        currency: "NGN",
        total_amount_minor: 5_000_000,
      },
      proposed_terms: {
        title: "Website redesign and build",
        currency: "NGN",
        total_amount_minor: 7_500_000,
      },
      proposed_terms_hash: "proposed-hash",
      changed_fields: ["title", "total_amount_minor"],
      contact_email: "customer@example.com",
      contact_phone: null,
      proposed_by: "44444444-4444-4444-8444-444444444444",
      created_at: "2026-08-30T10:00:00.000Z",
      submitted_at: "2026-08-30T10:00:00.000Z",
      first_opened_at: null,
      confirmed_at: null,
      revoked_at: null,
      revoked_reason: null,
      effective_terms: null,
      effective_terms_hash: null,
    };
    const summary: BookingAmendmentSummary = {
      latest: pending,
      history: [pending],
      displayStatus: "pending",
      requestEmailStatus: "SENT",
      confirmationEmailStatus: null,
      sharedAt: null,
      shareMethod: null,
    };

    renderPanel({ summary, canPropose: true });

    expect(screen.getByText("Changes awaiting customer confirmation")).toBeVisible();
    expect(screen.getByText("Reason: Customer requested a larger scope.")).toBeVisible();
    expect(screen.getByText("Website redesign and build")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Replace proposed changes" }),
    ).toBeVisible();
  });
});
