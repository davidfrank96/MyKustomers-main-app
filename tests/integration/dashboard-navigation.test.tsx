import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/dashboard-navigation";

let pathname = "/dashboard";
const linkStatus = vi.hoisted(() => ({
  pendingHref: null as string | null,
  listeners: new Set<() => void>(),
}));

function setPendingHref(href: string | null) {
  act(() => {
    linkStatus.pendingHref = href;
    linkStatus.listeners.forEach((listener) => listener());
  });
}

function expectLinkPending(link: HTMLElement, pending: boolean) {
  const busyContent = link.querySelector('[aria-busy="true"]');
  if (pending) expect(busyContent).not.toBeNull();
  else expect(busyContent).toBeNull();
}

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const LinkContext = React.createContext("");

  function subscribe(listener: () => void) {
    linkStatus.listeners.add(listener);
    return () => linkStatus.listeners.delete(listener);
  }

  function MockLink({
    children,
    href,
    onClick,
    ...props
  }: ComponentProps<"a"> & { href: string }) {
    const destination = String(href);

    return (
      <LinkContext.Provider value={destination}>
        <a
          {...props}
          href={`#${destination}`}
          onClick={(event) => {
            onClick?.(event);
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            ) {
              return;
            }
            linkStatus.pendingHref = destination;
            linkStatus.listeners.forEach((listener) => listener());
          }}
        >
          {children}
        </a>
      </LinkContext.Provider>
    );
  }

  function useLinkStatus() {
    const href = React.useContext(LinkContext);
    const pending = React.useSyncExternalStore(
      subscribe,
      () => linkStatus.pendingHref === href,
      () => false,
    );
    return { pending };
  }

  return { default: MockLink, useLinkStatus };
});

describe("dashboard navigation responsiveness", () => {
  beforeEach(() => {
    pathname = "/dashboard";
    linkStatus.pendingHref = null;
  });

  it.each([
    ["Vendor navigation", DesktopNavigation],
    ["Mobile vendor navigation", MobileNavigation],
  ])(
    "acknowledges %s navigation immediately and clears it at route arrival",
    (name, Navigation) => {
      const view = render(<Navigation />);
      const navigation = screen.getByRole("navigation", { name });
      const bookings = within(navigation).getByRole("link", { name: "Bookings" });

      expectLinkPending(bookings, false);
      expect(fireEvent.click(bookings)).toBe(true);
      expectLinkPending(bookings, true);
      expect(within(navigation).getByText("Opening Bookings")).toBeInTheDocument();

      setPendingHref(null);
      pathname = "/bookings";
      view.rerender(<Navigation />);
      expect(bookings).toHaveAttribute("aria-current", "page");
      expectLinkPending(bookings, false);
    },
  );

  it.each([
    ["Vendor navigation", DesktopNavigation],
    ["Mobile vendor navigation", MobileNavigation],
  ])("clears %s pending state when navigation fails", (name, Navigation) => {
    const view = render(<Navigation />);
    const navigation = screen.getByRole("navigation", { name });
    const home = within(navigation).getByRole("link", { name: "Home" });
    const bookings = within(navigation).getByRole("link", { name: "Bookings" });

    fireEvent.click(bookings);
    expectLinkPending(bookings, true);

    setPendingHref(null);
    view.rerender(<Navigation />);
    expect(home).toHaveAttribute("aria-current", "page");
    expectLinkPending(bookings, false);
  });

  it.each([
    ["Vendor navigation", DesktopNavigation],
    ["Mobile vendor navigation", MobileNavigation],
  ])("follows the final route after %s navigation redirects", (name, Navigation) => {
    const view = render(<Navigation />);
    const navigation = screen.getByRole("navigation", { name });
    const bookings = within(navigation).getByRole("link", { name: "Bookings" });
    const customers = within(navigation).getByRole("link", { name: "Customers" });

    fireEvent.click(bookings);
    expectLinkPending(bookings, true);

    setPendingHref(null);
    pathname = "/customers";
    view.rerender(<Navigation />);
    expect(customers).toHaveAttribute("aria-current", "page");
    expectLinkPending(bookings, false);
  });

  it("keeps only the latest requested destination pending", () => {
    render(<DesktopNavigation />);
    const bookings = screen.getByRole("link", { name: "Bookings" });
    const customers = screen.getByRole("link", { name: "Customers" });

    fireEvent.click(bookings);
    expectLinkPending(bookings, true);
    expectLinkPending(customers, false);

    fireEvent.click(customers);
    expectLinkPending(bookings, false);
    expectLinkPending(customers, true);
  });

  it("preserves modified and middle-click native link behavior", () => {
    render(<DesktopNavigation />);
    const bookings = screen.getByRole("link", { name: "Bookings" });

    expect(fireEvent.click(bookings, { metaKey: true })).toBe(true);
    expectLinkPending(bookings, false);

    expect(fireEvent.click(bookings, { ctrlKey: true })).toBe(true);
    expectLinkPending(bookings, false);

    expect(fireEvent.click(bookings, { button: 1 })).toBe(true);
    expectLinkPending(bookings, false);
  });

  it.each([
    ["Vendor navigation", DesktopNavigation],
    ["Mobile vendor navigation", MobileNavigation],
  ])(
    "does not resurrect a completed Home navigation in %s after leaving Dashboard",
    (name, Navigation) => {
      pathname = "/bookings";
      const view = render(<Navigation />);
      const navigation = screen.getByRole("navigation", { name });
      const home = within(navigation).getByRole("link", { name: "Home" });

      fireEvent.click(home);
      expectLinkPending(home, true);

      setPendingHref(null);
      pathname = "/dashboard";
      view.rerender(<Navigation />);
      expect(home).toHaveAttribute("aria-current", "page");
      expectLinkPending(home, false);

      pathname = "/bookings";
      view.rerender(<Navigation />);
      expectLinkPending(home, false);
    },
  );

  it("keeps exactly the five approved mobile destinations", () => {
    render(<MobileNavigation />);
    const navigation = screen.getByRole("navigation", {
      name: "Mobile vendor navigation",
    });
    const links = within(navigation).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Home",
      "Bookings",
      "Customers",
      "Insights",
      "Business",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });
});
