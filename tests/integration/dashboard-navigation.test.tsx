import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/dashboard-navigation";

let pathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a {...props} href={`#${href}`}>
      {children}
    </a>
  ),
}));

describe("dashboard navigation responsiveness", () => {
  beforeEach(() => {
    pathname = "/dashboard";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Vendor navigation", DesktopNavigation],
    ["Mobile vendor navigation", MobileNavigation],
  ])(
    "acknowledges %s navigation immediately and suppresses a duplicate click",
    (name, Navigation) => {
      const view = render(<Navigation />);
      const navigation = screen.getByRole("navigation", { name });
      const bookings = within(navigation).getByRole("link", { name: "Bookings" });

      expect(bookings).not.toHaveAttribute("aria-busy");
      expect(fireEvent.click(bookings)).toBe(true);
      expect(bookings).toHaveAttribute("aria-busy", "true");
      expect(within(navigation).getByText("Opening Bookings")).toBeInTheDocument();

      expect(fireEvent.click(bookings)).toBe(false);

      pathname = "/bookings";
      view.rerender(<Navigation />);
      expect(bookings).toHaveAttribute("aria-current", "page");
      expect(bookings).not.toHaveAttribute("aria-busy");
    },
  );

  it("releases pending feedback when a navigation never completes", () => {
    vi.useFakeTimers();
    render(<DesktopNavigation />);
    const bookings = screen.getByRole("link", { name: "Bookings" });

    fireEvent.click(bookings);
    expect(bookings).toHaveAttribute("aria-busy", "true");

    act(() => vi.advanceTimersByTime(15_000));
    expect(bookings).not.toHaveAttribute("aria-busy");
  });

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
