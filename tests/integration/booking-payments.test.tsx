import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingPayments } from "@/components/bookings/booking-payments";
import type { BookingPaymentSummary } from "@/features/bookings/queries";

const summary: BookingPaymentSummary = {
  currency: "NGN",
  effectiveTotalAmountMinor: 4_500_000,
  initialDepositAmountMinor: 500_000,
  confirmedAddonDepositAmountMinor: 250_000,
  subsequentPaymentAmountMinor: 1_000_000,
  recordedPaidAmountMinor: 1_750_000,
  outstandingAmountMinor: 2_750_000,
};

describe("booking payments", () => {
  it("renders the authoritative totals and append-only payment history", () => {
    render(
      <BookingPayments
        summary={summary}
        payments={[
          {
            id: "00000000-0000-4000-8000-000000000010",
            business_id: "00000000-0000-4000-8000-000000000011",
            booking_id: "00000000-0000-4000-8000-000000000012",
            operation_id: "00000000-0000-4000-8000-000000000013",
            amount_minor: 1_000_000,
            recorded_by: "00000000-0000-4000-8000-000000000014",
            recorded_at: "2026-08-26T10:00:00.000Z",
            created_at: "2026-08-26T10:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000020",
            business_id: "00000000-0000-4000-8000-000000000011",
            booking_id: "00000000-0000-4000-8000-000000000012",
            operation_id: "00000000-0000-4000-8000-000000000023",
            amount_minor: 250_000,
            recorded_by: "00000000-0000-4000-8000-000000000014",
            recorded_at: "2026-08-27T11:30:00.000Z",
            created_at: "2026-08-27T11:30:00.000Z",
          },
        ]}
        canRecordPayment
        action={vi.fn()}
      />,
    );

    expect(screen.getByText("₦45,000")).toBeInTheDocument();
    expect(screen.getByText("₦17,500")).toBeInTheDocument();
    expect(screen.getByText("₦27,500")).toBeInTheDocument();
    expect(screen.getByText("Confirmed add-on deposits")).toBeInTheDocument();
    expect(screen.getAllByText(/Payment recorded/)).toHaveLength(2);
    expect(screen.getByText("Payment recording only")).toBeVisible();
    expect(
      screen.getByText(
        "Payments are recorded as reported. My Kustomers does not process payments.",
      ),
    ).toBeVisible();
  });

  it("shows a truthful empty breakdown when no payment components exist", () => {
    render(
      <BookingPayments
        summary={{
          ...summary,
          initialDepositAmountMinor: 0,
          confirmedAddonDepositAmountMinor: 0,
          subsequentPaymentAmountMinor: 0,
          recordedPaidAmountMinor: 0,
          outstandingAmountMinor: summary.effectiveTotalAmountMinor,
        }}
        payments={[]}
        canRecordPayment={false}
        action={vi.fn()}
      />,
    );

    expect(screen.getByText("No payments recorded yet.")).toBeVisible();
    expect(screen.queryByText("Initial deposit")).toBeNull();
    expect(screen.getByText("₦0")).toBeVisible();
  });

  it("renders large server-derived values without changing currency semantics", () => {
    render(
      <BookingPayments
        summary={{
          ...summary,
          currency: "EUR",
          effectiveTotalAmountMinor: 1_000_000_428_000_000,
          initialDepositAmountMinor: 0,
          confirmedAddonDepositAmountMinor: 0,
          subsequentPaymentAmountMinor: 0,
          recordedPaidAmountMinor: 0,
          outstandingAmountMinor: 1_000_000_428_000_000,
        }}
        payments={[]}
        canRecordPayment={false}
        action={vi.fn()}
      />,
    );

    expect(screen.getAllByText("€10,000,004,280,000")).toHaveLength(2);
    expect(screen.queryByText(/₦/)).toBeNull();
  });

  it("opens an application dialog and explains that recording does not process payment", () => {
    render(
      <BookingPayments
        summary={summary}
        payments={[]}
        canRecordPayment
        action={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.getByRole("dialog", { name: "Record a payment" })).toBeVisible();
    expect(screen.getByText(/does not process a payment/)).toBeVisible();
    expect(screen.getByLabelText("Payment amount")).toHaveAttribute("max", "27500.00");
  });

  it("fails closed when the payment summary cannot be verified", () => {
    render(
      <BookingPayments
        summary={null}
        payments={[]}
        canRecordPayment
        action={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Payment status is temporarily unavailable",
    );
  });

  it("shows truthful paid-in-full guidance only when authoritative outstanding is zero", () => {
    render(
      <BookingPayments
        summary={{
          ...summary,
          subsequentPaymentAmountMinor: 3_750_000,
          recordedPaidAmountMinor: 4_500_000,
          outstandingAmountMinor: 0,
        }}
        payments={[]}
        canRecordPayment
        action={vi.fn()}
      />,
    );

    expect(screen.getByText("Payment complete")).toBeVisible();
    expect(
      screen.getByText("All agreed payment has been recorded as received."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
  });
});
