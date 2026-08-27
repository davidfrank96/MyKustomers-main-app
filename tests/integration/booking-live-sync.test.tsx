import { render, screen, waitFor } from "@testing-library/react";
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
});
