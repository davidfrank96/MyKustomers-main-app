import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageMotionController } from "@/components/homepage/homepage-motion-controller";
import {
  HomepageHeroSignals,
  HomepageLoyaltyVisual,
} from "@/components/homepage/homepage-motion";

let callback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();
const pause = vi.fn();
const resume = vi.fn();
const reset = vi.fn();
let reduced: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let wide: typeof reduced;
function fixture() {
  return render(
    <main>
      <div data-homepage-motion="hero">
        <HomepageHeroSignals />
      </div>
      <div data-homepage-motion="journey">
        Request → Confirmation → Updates → Delivery → Feedback
      </div>
      <div data-homepage-motion="loyalty">
        <HomepageLoyaltyVisual />
      </div>
      <HomepageMotionController />
    </main>,
  );
}
function intersect(target: Element, isIntersecting = true) {
  act(() =>
    callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
}
function visibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}
function changeMedia(media: typeof reduced, matches: boolean) {
  media.matches = matches;
  act(() => media.addEventListener.mock.calls[0][1]());
}

beforeEach(() => {
  vi.clearAllMocks();
  reduced = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  wide = {
    ...reduced,
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => (query.includes("reduced-motion") ? reduced : wide)),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("SVGSVGElement", SVGSVGElement);
  Object.defineProperties(SVGSVGElement.prototype, {
    pauseAnimations: { configurable: true, value: pause },
    unpauseAnimations: { configurable: true, value: resume },
    setCurrentTime: { configurable: true, value: reset },
  });
  visibility("visible");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("homepage supporting motion", () => {
  it("exposes all customer messages as static semantic text without live announcements or focusable cards", () => {
    const { container } = fixture();
    expect(
      screen.getByRole("list", { name: "Illustrative customer updates" }),
    ).toHaveTextContent("Customer confirmed");
    const updates = screen.getByRole("list", {
      name: "From a confirmed booking to customer feedback",
    });
    expect(updates.querySelectorAll("li")).toHaveLength(3);
    expect(updates).toHaveTextContent("Private feedback");
    expect(
      container.querySelectorAll(
        "[aria-live], [role=status], li button, li a, li [tabindex]",
      ),
    ).toHaveLength(0);
    for (const wire of container.querySelectorAll("[data-motion-wire]"))
      expect(wire).toHaveAttribute("aria-hidden", "true");
  });

  it("shares one observer, starts regions independently, and pauses without replaying their entrance", () => {
    const { container } = fixture();
    const hero = container.querySelector('[data-homepage-motion="hero"]')!;
    const loyalty = container.querySelector('[data-homepage-motion="loyalty"]')!;
    expect(observe).toHaveBeenCalledTimes(3);
    expect(loyalty).not.toHaveAttribute("data-motion-entered");
    intersect(hero);
    expect(hero).toHaveAttribute("data-motion-running", "true");
    expect(loyalty).toHaveAttribute("data-motion-running", "false");
    intersect(hero, false);
    expect(hero).toHaveAttribute("data-motion-entered", "true");
    expect(hero).toHaveAttribute("data-motion-running", "false");
    intersect(loyalty);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(2);
    intersect(loyalty, false);
    intersect(loyalty);
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("renders static content immediately for reduced motion and responds to preference changes", () => {
    reduced.matches = true;
    const { container } = fixture();
    const hero = container.querySelector('[data-homepage-motion="hero"]')!;
    intersect(hero);
    expect(hero).toHaveAttribute("data-motion-static", "true");
    expect(hero).toHaveAttribute("data-motion-running", "false");
    expect(screen.queryByRole("button")).toBeNull();
    changeMedia(reduced, false);
    expect(hero).toHaveAttribute("data-motion-running", "true");
    changeMedia(reduced, true);
    expect(hero).toHaveAttribute("data-motion-static", "true");
  });

  it("pauses hidden documents and resumes only intersecting regions", () => {
    const { container } = fixture();
    const hero = container.querySelector('[data-homepage-motion="hero"]')!;
    const loyalty = container.querySelector('[data-homepage-motion="loyalty"]')!;
    intersect(hero);
    visibility("hidden");
    expect(hero).toHaveAttribute("data-motion-running", "false");
    visibility("visible");
    expect(hero).toHaveAttribute("data-motion-running", "true");
    expect(loyalty).toHaveAttribute("data-motion-running", "false");
  });

  it("provides a keyboard-operable pause that reveals a complete static story", () => {
    const { container } = fixture();
    const hero = container.querySelector('[data-homepage-motion="hero"]')!;
    intersect(hero);
    fireEvent.click(screen.getByRole("button", { name: "Pause supporting motion" }));
    expect(hero).toHaveAttribute("data-motion-static", "true");
    expect(
      screen.getByRole("button", { name: "Resume supporting motion" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Resume supporting motion" }));
    expect(hero).toHaveAttribute("data-motion-running", "true");
  });

  it("runs only the wire appropriate to the current breakpoint", () => {
    const { container } = fixture();
    intersect(container.querySelector('[data-homepage-motion="loyalty"]')!);
    expect(resume.mock.instances.at(-1)).toHaveAttribute("data-motion-wire", "desktop");
    changeMedia(wide, false);
    expect(resume.mock.instances.at(-1)).toHaveAttribute("data-motion-wire", "mobile");
    expect(pause.mock.instances).toContain(
      container.querySelector('[data-motion-wire="desktop"]'),
    );
  });

  it("disconnects, removes subscriptions, and restores static markup on unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { container, unmount } = fixture();
    const hero = container.querySelector('[data-homepage-motion="hero"]')!;
    intersect(hero);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(reduced.removeEventListener).toHaveBeenCalledWith(
      "change",
      reduced.addEventListener.mock.calls[0][1],
    );
    expect(wide.removeEventListener).toHaveBeenCalledWith(
      "change",
      wide.addEventListener.mock.calls[0][1],
    );
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(hero).not.toHaveAttribute("data-motion-ready");
    remove.mockRestore();
  });

  it("keeps meaningful static content if IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    const { container } = fixture();
    expect(container.querySelector("[data-motion-ready]")).toBeNull();
    expect(screen.getByText("Booking confirmed")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
