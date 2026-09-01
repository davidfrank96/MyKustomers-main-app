import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import { BookingAddonPanel } from "@/components/forms/booking-addon-panel";
import type { AddonActionState } from "@/features/addons/action-state";
import type { BookingAddonItem, BookingAddonSummary } from "@/features/addons/queries";

const emptySummary: BookingAddonSummary = {
  items: [],
  totalAmountMinor: 5_000_000,
  depositAmountMinor: 3_000_000,
  balanceAmountMinor: 2_000_000,
  confirmedAddonCount: 0,
  hasAwaitingAddon: false,
};

type CreateAction = (
  previousState: AddonActionState,
  formData: FormData,
) => Promise<AddonActionState>;

const idleCreateAction = vi.fn<CreateAction>(async () => ({ status: "idle" }));
const idleMutationAction = vi.fn(async () => ({ status: "idle" as const }));
const recordShareAction = vi.fn(async () => undefined);

function addon(status: BookingAddonItem["status"]): BookingAddonItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    business_id: "22222222-2222-4222-8222-222222222222",
    booking_id: "33333333-3333-4333-8333-333333333333",
    created_by: "44444444-4444-4444-8444-444444444444",
    title: "24 Cupcakes",
    description: "Decorated cupcakes for the same delivery.",
    currency: "NGN",
    total_amount_minor: 1_800_000,
    deposit_amount_minor: 500_000,
    status,
    created_at: "2026-08-30T10:00:00.000Z",
    submitted_at: status === "DRAFT" ? null : "2026-08-30T10:05:00.000Z",
    confirmed_at: status === "CONFIRMED" ? "2026-08-30T11:00:00.000Z" : null,
    cancelled_at: null,
    cancellation_reason: null,
    terms_snapshot: null,
    terms_hash: null,
    confirmation_contact_email: null,
    confirmation_contact_phone: null,
    latestLink: null,
    requestEmailStatus: null,
    confirmationEmailStatus: status === "CONFIRMED" ? "SENT" : null,
  };
}

function renderPanel({
  summary = emptySummary,
  canCreate = true,
  requestBlocked = false,
  createAction = idleCreateAction,
}: {
  summary?: BookingAddonSummary;
  canCreate?: boolean;
  requestBlocked?: boolean;
  createAction?: CreateAction;
} = {}) {
  return render(
    <BookingDetailSection
      id="booking-addons"
      title="Booking add-ons"
      summary={
        summary.confirmedAddonCount > 0
          ? `${summary.confirmedAddonCount} confirmed`
          : "No confirmed add-ons"
      }
      icon="addon"
      defaultOpen
    >
      <BookingAddonPanel
        summary={summary}
        canCreate={canCreate}
        requestBlocked={requestBlocked}
        currency="NGN"
        originalTotalAmountMinor={5_000_000}
        originalDepositAmountMinor={3_000_000}
        businessName="Example Business"
        customerName="Ada"
        createAction={createAction}
        submitAction={idleMutationAction}
        cancelAction={idleMutationAction}
        recordShareAction={recordShareAction}
      />
    </BookingDetailSection>,
  );
}

describe("booking add-on panel presentation", () => {
  it("renders the authoritative summary, breakdown, empty state, and accordion behavior", () => {
    renderPanel({ canCreate: false });

    expect(screen.getAllByText("₦50,000")).toHaveLength(3);
    expect(screen.getAllByText("₦30,000")).toHaveLength(2);
    expect(screen.getByText("₦20,000")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Value breakdown" })).toBeVisible();
    expect(screen.getByText("No add-ons recorded.")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Add-ons are available only while a confirmed booking is confirmed or in progress.",
    );

    const trigger = screen.getByRole("button", { name: /Booking add-ons/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("No add-ons recorded.")).not.toBeVisible();
  });

  it("opens and cancels the existing Add item dialog with every supported field", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeVisible();
    expect(screen.getByLabelText("Title")).toBeVisible();
    expect(screen.getByLabelText("Description")).toBeVisible();
    expect(screen.getByLabelText("Agreed amount")).toBeVisible();
    expect(screen.getByLabelText("Deposit recorded")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Add item" })).not.toBeInTheDocument();
  });

  it("renders server validation in the redesigned dialog", async () => {
    const createAction = vi.fn<CreateAction>(async () => ({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        title: ["Add-on title is required."],
        totalAmount: ["Agreed amount is required."],
      },
    }));
    renderPanel({ createAction });

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.click(screen.getByRole("button", { name: "Save add-on draft" }));

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Add-on title is required.")).toBeVisible();
    expect(screen.getByText("Agreed amount is required.")).toBeVisible();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(screen.getByText("Check the highlighted fields.")).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits through the existing create handler and closes on success", async () => {
    const createAction = vi.fn<CreateAction>(async () => ({ status: "success" }));
    renderPanel({ createAction });

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "24 Cupcakes" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Decorated cupcakes" },
    });
    fireEvent.change(screen.getByLabelText("Agreed amount"), {
      target: { value: "18000" },
    });
    fireEvent.change(screen.getByLabelText("Deposit recorded"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save add-on draft" }));

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const formData = createAction.mock.calls[0]?.[1];
    expect(formData?.get("title")).toBe("24 Cupcakes");
    expect(formData?.get("totalAmount")).toBe("18000");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add item" })).not.toBeInTheDocument(),
    );
  });

  it("preserves draft actions and confirmed add-on value evidence", () => {
    const confirmed = addon("CONFIRMED");
    const draft = { ...addon("DRAFT"), id: "55555555-5555-4555-8555-555555555555" };
    renderPanel({
      summary: {
        items: [confirmed, draft],
        totalAmountMinor: 6_800_000,
        depositAmountMinor: 3_500_000,
        balanceAmountMinor: 3_300_000,
        confirmedAddonCount: 1,
        hasAwaitingAddon: false,
      },
    });

    expect(screen.getAllByText("24 Cupcakes")).toHaveLength(3);
    expect(screen.getByText("Confirmed", { exact: true })).toBeVisible();
    expect(screen.getByText("Draft", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send for confirmation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel add-on" })).toBeVisible();
    expect(screen.getAllByText("₦68,000")).toHaveLength(2);
  });
});
