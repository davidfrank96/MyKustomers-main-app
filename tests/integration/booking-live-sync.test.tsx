import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOKING_POLL_INTERVAL_MS,
  BookingLiveSync,
} from "@/components/bookings/booking-live-sync";
import { PWA_BOOKING_RECONCILE_EVENT } from "@/features/pwa/reconciliation";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const initialState = {
  revision: "DRAFT:initial::",
  status: "DRAFT" as const,
  customerConfirmedAt: null,
  feedbackSubmittedAt: null,
};

function liveState(
  status: "DELIVERED" | "COMPLETED" | "CANCELLED",
  revision: string = status,
  feedbackSubmittedAt: string | null = null,
) {
  return {
    revision,
    status,
    customerConfirmedAt: "2026-09-03T10:00:00.000Z",
    feedbackSubmittedAt,
  } as const;
}

describe("BookingLiveSync PWA reconciliation", () => {
  beforeEach(() => {
    navigation.refresh.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("claims one booking resume check, announces a meaningful change, and refreshes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          revision: "IN_PROGRESS:next:confirmed:",
          status: "IN_PROGRESS",
          customerConfirmedAt: "2026-08-27T12:00:00.000Z",
          feedbackSubmittedAt: null,
        }),
      ),
    );
    render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={initialState}
      />,
    );

    window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));

    expect(await screen.findByText("Customer confirmed")).toBeVisible();
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("still refreshes high-integrity booking data when the minimized revision is unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(initialState)),
    );
    render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={initialState}
      />,
    );

    window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));

    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the bounded visible fallback interval and makes no hidden-tab request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => Response.json(initialState));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={initialState}
      />,
    );

    await vi.advanceTimersByTimeAsync(BOOKING_POLL_INTERVAL_MS);
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await vi.advanceTimersByTimeAsync(BOOKING_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens one accessible success dialog when fresh server props enter completed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(liveState("COMPLETED"))));
    const { rerender } = render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("DELIVERED")}
      />,
    );

    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();
    rerender(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("COMPLETED", "completed-on-action")}
      />,
    );

    expect(await screen.findByRole("dialog", { name: "Booking complete" })).toHaveTextContent(
      "Everything for this booking is finished.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull(),
    );

    rerender(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("COMPLETED", "completed-repeated")}
      />,
    );
    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();
  });

  it("does not celebrate a historical completed initial load", () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(liveState("COMPLETED"))));
    render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("COMPLETED")}
      />,
    );

    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();
  });

  it("supports keyboard dismissal, focus return, and reduced motion", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(liveState("COMPLETED"))));
    const { rerender } = render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("DELIVERED")}
      />,
    );
    const returnTarget = document.createElement("button");
    returnTarget.textContent = "Return target";
    document.body.append(returnTarget);
    returnTarget.focus();

    rerender(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("COMPLETED", "completed-for-keyboard")}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Booking complete" });
    expect(dialog.querySelector("[data-booking-complete-icon]")).toHaveClass(
      "motion-reduce:transition-none",
    );
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(returnTarget));
    returnTarget.remove();
  });

  it("returns focus to the stable journey heading when the prior control was replaced", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(liveState("COMPLETED"))));
    const view = (status: "DELIVERED" | "COMPLETED", revision: string) => (
      <>
        <h2 id="booking-journey-title" tabIndex={-1}>
          Booking journey
        </h2>
        <BookingLiveSync
          bookingId="00000000-0000-4000-8000-000000000001"
          initialState={liveState(status, revision)}
        />
      </>
    );
    const { rerender } = render(view("DELIVERED", "delivered-before-action"));
    (document.activeElement as HTMLElement | null)?.blur();

    rerender(view("COMPLETED", "completed-after-action"));
    const dialog = await screen.findByRole("dialog", { name: "Booking complete" });
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

    const heading = screen.getByRole("heading", { name: "Booking journey" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("shows completion once when reconciliation observes feedback auto-completion", async () => {
    const completed = liveState(
      "COMPLETED",
      "completed-by-feedback",
      "2026-09-03T10:05:00.000Z",
    );
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(completed)));
    render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("DELIVERED")}
      />,
    );

    window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));
    expect(await screen.findByRole("dialog", { name: "Booking complete" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();
  });

  it("does not show completion for feedback with an outstanding balance or cancellation", async () => {
    const deliveredWithFeedback = liveState(
      "DELIVERED",
      "feedback-with-balance",
      "2026-09-03T10:05:00.000Z",
    );
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(deliveredWithFeedback)));
    const { rerender } = render(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("DELIVERED")}
      />,
    );

    window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));
    await screen.findByText("New customer feedback");
    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();

    rerender(
      <BookingLiveSync
        bookingId="00000000-0000-4000-8000-000000000001"
        initialState={liveState("CANCELLED", "cancelled")}
      />,
    );
    expect(screen.queryByRole("dialog", { name: "Booking complete" })).toBeNull();
  });
});
