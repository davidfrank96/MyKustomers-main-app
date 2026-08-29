import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersMobileActions } from "@/components/customers/customers-mobile-actions";
import { mobileBackToTopThreshold } from "@/components/shared/mobile-quick-actions";

describe("customers mobile actions", () => {
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
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scrollTo.mockReset();
  });

  it("keeps customer creation available while back to top is hidden", () => {
    const { container } = render(<CustomersMobileActions />);

    expect(screen.getByRole("link", { name: "Add customer" })).toHaveAttribute(
      "href",
      "/customers/new",
    );
    expect(container.querySelector("[data-customers-mobile-actions]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
  });

  it("reveals back to top at the shared threshold and hides it near the top", () => {
    render(<CustomersMobileActions />);

    act(() => {
      window.scrollY = mobileBackToTopThreshold;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });
    expect(screen.getByRole("button", { name: "Back to top" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add customer" })).toBeVisible();

    act(() => {
      window.scrollY = 0;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
  });

  it("uses smooth scrolling by default and immediate scrolling for reduced motion", () => {
    const { rerender } = render(<CustomersMobileActions />);
    act(() => {
      window.scrollY = mobileBackToTopThreshold;
      fireEvent.scroll(window);
      flushAnimationFrame();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });

    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList);
    rerender(<CustomersMobileActions />);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "auto" });
  });
});
