import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerLoadMoreList } from "@/components/customers/customer-load-more-list";
import type { CustomerListItem } from "@/features/customers/queries";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function customer(index: number): CustomerListItem {
  return {
    id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
    name: "Customer " + index,
    email: "customer-" + index + "@example.com",
    phone: null,
    archived_at: null,
    created_at: new Date(Date.UTC(2026, 7, 31, 12, 0, 60 - index)).toISOString(),
  };
}

describe("bounded Load more lists", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads one 25-record cursor batch, blocks rapid duplicates, and announces append", async () => {
    const initialCustomers = Array.from({ length: 25 }, (_, index) =>
      customer(index + 1),
    );
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

    render(
      <CustomerLoadMoreList
        initialCustomers={initialCustomers}
        total={26}
        q="Sarah & Co"
        status="all"
      />,
    );

    const loadMore = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(loadMore);
    fireEvent.click(loadMore);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Loading more…" })).toBeDisabled();
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("/api/customers/list?");
    expect(requestUrl).toContain("status=all");
    expect(requestUrl).toContain("q=Sarah+%26+Co");
    expect(requestUrl).toContain("cursorCreatedAt=");
    expect(requestUrl).toContain("cursorId=");

    resolveFetch?.(
      new Response(
        JSON.stringify({ customers: [customer(26)], hasMore: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect.poll(() => screen.getAllByRole("link").length).toBe(26);
    expect(screen.getByText("Showing 26 of 26 customers.")).toBeInTheDocument();
    expect(screen.getByText("1 more customer loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("keeps existing rows and offers a localized retry after a failed batch", async () => {
    const initialCustomers = Array.from({ length: 25 }, (_, index) =>
      customer(index + 1),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "error" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <CustomerLoadMoreList
        initialCustomers={initialCustomers}
        total={50}
        q=""
        status="active"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t load more customers. Check your connection and try again.",
      ),
    );
    expect(screen.getAllByRole("link")).toHaveLength(25);
    expect(screen.getByText("Showing 25 of 50 customers.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
  });
});
