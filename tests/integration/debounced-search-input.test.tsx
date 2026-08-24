import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSearchHref,
  DebouncedSearchInput,
} from "@/components/shared/debounced-search-input";

const navigation = vi.hoisted(() => ({
  pathname: "/bookings",
  searchParams: "filter=overdue&page=7",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.searchParams),
}));

describe("DebouncedSearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigation.pathname = "/bookings";
    navigation.searchParams = "filter=overdue&page=7";
    navigation.replace.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("performs one replace navigation after rapid typing", () => {
    render(
      <DebouncedSearchInput
        clearLabel="Clear booking search"
        initialValue=""
        label="Search bookings"
        placeholder="Search bookings"
      />,
    );

    const input = screen.getByLabelText("Search bookings");
    for (const query of ["S", "Sa", "Sar", "Sara", "Sarah"]) {
      fireEvent.change(input, { target: { value: query } });
    }

    act(() => vi.advanceTimersByTime(299));
    expect(navigation.replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith(
      "/bookings?filter=overdue&q=Sarah",
      { scroll: false },
    );
  });

  it("clears the query immediately while preserving filters and resetting pagination", () => {
    navigation.pathname = "/customers";
    navigation.searchParams = "status=archived&page=4&q=Sarah";

    render(
      <DebouncedSearchInput
        clearLabel="Clear customer search"
        initialValue="Sarah"
        label="Search customers"
        placeholder="Search customers"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear customer search" }));

    expect(screen.getByLabelText("Search customers")).toHaveValue("");
    expect(navigation.replace).toHaveBeenCalledWith("/customers?status=archived", {
      scroll: false,
    });
  });

  it("builds encoded URLs without replacing compatible filter state", () => {
    expect(
      buildSearchHref({
        pathname: "/customers",
        searchParams: new URLSearchParams("status=all&page=9&limit=25"),
        query: " Sarah & Co ",
      }),
    ).toBe("/customers?status=all&limit=25&q=Sarah+%26+Co");
  });

  it("synchronizes the input when navigation changes the URL externally", () => {
    navigation.pathname = "/customers";
    navigation.searchParams = "status=all&q=Sarah";
    const view = render(
      <DebouncedSearchInput
        clearLabel="Clear customer search"
        initialValue="Sarah"
        label="Search customers"
        placeholder="Search customers"
      />,
    );

    navigation.searchParams = "status=all&q=David";
    view.rerender(
      <DebouncedSearchInput
        clearLabel="Clear customer search"
        initialValue="Sarah"
        label="Search customers"
        placeholder="Search customers"
      />,
    );

    expect(screen.getByLabelText("Search customers")).toHaveValue("David");
    act(() => vi.advanceTimersByTime(300));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("cancels a pending debounce when unmounted", () => {
    const view = render(
      <DebouncedSearchInput
        clearLabel="Clear booking search"
        initialValue=""
        label="Search bookings"
        placeholder="Search bookings"
      />,
    );

    fireEvent.change(screen.getByLabelText("Search bookings"), {
      target: { value: "Sarah" },
    });
    view.unmount();
    act(() => vi.advanceTimersByTime(500));

    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
