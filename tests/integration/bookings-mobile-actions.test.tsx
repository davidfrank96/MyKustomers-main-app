import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingsMobileActions,
  bookingsBackToTopThreshold,
} from "@/components/bookings/bookings-mobile-actions";

describe("bookings mobile actions", () => {
  const scrollTo = vi.fn();
  let animationFrames: FrameRequestCallback[];

  function flushAnimationFrame() {
    animationFrames.shift()?.(0);
  }

  beforeEach(() => {
    animationFrames = [];
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
      writable: true,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scrollTo.mockReset();
  });

  it("keeps the existing booking route available while back to top is hidden", () => {
    render(<BookingsMobileActions />);

    expect(screen.getByRole("link", { name: "Create new booking" })).toHaveAttribute(
      "href",
      "/bookings/new",
    );
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
  });

  it("reveals back to top only after the stable scroll threshold", () => {
    render(<BookingsMobileActions />);

    act(() => {
      window.scrollY = bookingsBackToTopThreshold - 1;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();

    act(() => {
      window.scrollY = bookingsBackToTopThreshold;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });
    expect(screen.getByRole("button", { name: "Back to top" })).toBeVisible();
  });

  it("uses smooth scrolling by default and immediate scrolling for reduced motion", () => {
    const { rerender } = render(<BookingsMobileActions />);
    act(() => {
      window.scrollY = bookingsBackToTopThreshold;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });

    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList);
    rerender(<BookingsMobileActions />);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "auto" });
  });
});
