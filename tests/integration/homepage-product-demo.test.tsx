import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageProductDemo } from "@/components/homepage/homepage-product-demo";

let observerCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList),
  );
}

function showDemo(isVisible = true) {
  act(() => {
    observerCallback(
      [
        {
          isIntersecting: isVisible,
          intersectionRatio: isVisible ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

function advanceStep() {
  act(() => vi.runOnlyPendingTimers());
}

function setDocumentVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}

describe("HomepageProductDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    observe.mockReset();
    disconnect.mockReset();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }

        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
        takeRecords = vi.fn(() => []);
        root = null;
        rootMargin = "0px";
        thresholds = [0, 0.25, 0.35];
      },
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders isolated demo fixtures with accessible controls and context", () => {
    render(<HomepageProductDemo />);

    expect(
      screen.getByRole("region", {
        name: "Illustrative My Kustomers workspace preview",
      }),
    ).toHaveAccessibleDescription(/customer booking being confirmed/i);
    expect(
      screen.getByRole("button", { name: "Pause My Kustomers product demo" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Replay My Kustomers product demo" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("img", { name: "Bookings trend increased" })).toBeVisible();
  });

  it("progresses through booking, email, work, feedback, and insights", () => {
    render(<HomepageProductDemo />);
    showDemo();

    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Created");
    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Confirmed");
    advanceStep();
    expect(screen.getByTestId("demo-email-status")).toHaveTextContent("Sending…");
    advanceStep();
    expect(screen.getByTestId("demo-email-status")).toHaveTextContent("Sent");
    advanceStep();
    expect(screen.getByTestId("demo-work-status")).toHaveTextContent("Pending");
    advanceStep();
    expect(screen.getByTestId("demo-work-status")).toHaveTextContent("In progress");
    advanceStep();
    expect(screen.getByTestId("demo-feedback")).toHaveAttribute("aria-hidden", "false");
    advanceStep();
    expect(screen.getByTestId("demo-feedback-status")).toHaveTextContent("5 ★");
    advanceStep();
    expect(screen.getByTestId("demo-insights")).toHaveTextContent(
      "Waiting for activity…",
    );
    advanceStep();
    expect(screen.getByTestId("demo-insights")).toHaveTextContent(
      "Bookings up 18% vs last week",
    );
  });

  it("pauses, resumes, and replays without losing the current layout", () => {
    render(<HomepageProductDemo />);
    showDemo();

    fireEvent.click(
      screen.getByRole("button", { name: "Pause My Kustomers product demo" }),
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("demo-booking")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Resume My Kustomers product demo" }),
    );
    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Created");

    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Confirmed");
    fireEvent.click(
      screen.getByRole("button", { name: "Replay My Kustomers product demo" }),
    );
    expect(screen.getByTestId("demo-booking")).toHaveAttribute("aria-hidden", "true");
    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Created");
  });

  it("renders the completed state without timed motion for reduced-motion users", () => {
    setReducedMotion(true);
    render(<HomepageProductDemo />);

    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Confirmed");
    expect(screen.getByTestId("demo-email-status")).toHaveTextContent("Sent");
    expect(screen.getByTestId("demo-work-status")).toHaveTextContent("In progress");
    expect(screen.getByTestId("demo-feedback-status")).toHaveTextContent("5 ★");
    expect(screen.getByTestId("demo-insights")).toHaveTextContent(
      "Bookings up 18% vs last week",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not advance while offscreen and resumes from the current stage", () => {
    render(<HomepageProductDemo />);
    showDemo();
    showDemo(false);

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("demo-booking")).toHaveAttribute("aria-hidden", "true");

    showDemo();
    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Created");
  });

  it("pauses while the page is hidden and resumes when visibility returns", () => {
    render(<HomepageProductDemo />);
    showDemo();
    setDocumentVisibility("hidden");

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("demo-booking")).toHaveAttribute("aria-hidden", "true");

    setDocumentVisibility("visible");
    advanceStep();
    expect(screen.getByTestId("demo-booking-status")).toHaveTextContent("Created");
  });

  it("cleans up its observer and pending timer on unmount", () => {
    const view = render(<HomepageProductDemo />);
    showDemo();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
