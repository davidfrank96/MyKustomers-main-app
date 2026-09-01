import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AttentionStatusGroup,
  ViewTodayBookingsLink,
} from "@/components/dashboard/attention-status-group";

function booking(id: string, title: string, customerName = "Esther") {
  return {
    id,
    title,
    scheduled_for: "2026-08-29T12:59:00.000Z",
    customer: {
      id: `customer-${id}`,
      name: customerName,
      email: null,
      phone: null,
    },
  };
}

const statusCases = [
  {
    status: "dueToday" as const,
    label: "Due today",
    accent: "border-l-rose-500",
    viewAll: "View all due today",
    noun: "due today",
    href: "/bookings?filter=today",
  },
  {
    status: "overdue" as const,
    label: "Overdue",
    accent: "border-l-orange-500",
    viewAll: "View all overdue",
    noun: "overdue",
    href: "/bookings?filter=overdue",
  },
  {
    status: "inProgress" as const,
    label: "In progress",
    accent: "border-l-blue-500",
    viewAll: "View all in progress",
    noun: "in progress",
    href: "/bookings?filter=IN_PROGRESS",
  },
  {
    status: "ready" as const,
    label: "Ready",
    accent: "border-l-emerald-500",
    viewAll: "View all ready",
    noun: "ready",
    href: "/bookings?filter=READY",
  },
];

describe("dashboard attention status groups", () => {
  it.each([0, 1, 3, 7, 20])(
    "shows the real total and caps an overdue preview containing %i bookings",
    (totalCount) => {
      const bookings = Array.from({ length: totalCount }, (_, index) =>
        booking(`preview-${index + 1}`, `Preview booking ${index + 1}`),
      );

      render(
        <AttentionStatusGroup
          status="overdue"
          bookings={bookings}
          totalCount={totalCount}
          empty="No overdue bookings."
        />,
      );

      const group = screen.getByRole("group", { name: "Overdue" });
      const expectedPreviewCount = Math.min(totalCount, 3);
      const count = group.querySelector(`[data-attention-count="${totalCount}"]`);

      expect(count).not.toBeNull();
      expect(count).toHaveTextContent(String(totalCount));
      expect(
        within(group).getByText(
          `${totalCount} ${totalCount === 1 ? "booking" : "bookings"}`,
        ),
      ).toBeVisible();
      expect(
        group.querySelectorAll('a[href^="/bookings/preview-"]'),
      ).toHaveLength(expectedPreviewCount);

      if (totalCount === 0) {
        expect(within(group).getByText("No overdue bookings.")).toBeVisible();
      }

      if (totalCount > 3) {
        expect(
          within(group).getByText(`Showing 3 of ${totalCount}`),
        ).toBeVisible();
        expect(
          within(group).getByRole("link", {
            name: `View all ${totalCount} overdue bookings`,
          }),
        ).toHaveAttribute("href", "/bookings?filter=overdue");
      } else {
        expect(within(group).queryByText(/^Showing /)).toBeNull();
        expect(within(group).queryByText("View all overdue")).toBeNull();
      }
    },
  );

  it.each(statusCases)(
    "uses the $label status treatment and filtered navigation",
    ({ status, label, accent, viewAll, noun, href }) => {
      const bookings = Array.from({ length: 7 }, (_, index) =>
        booking(
          `preview-${index + 1}`,
          index === 0
            ? "A deliberately long booking title that wraps safely"
            : `Preview booking ${index + 1}`,
        ),
      );

      render(
        <AttentionStatusGroup
          status={status}
          bookings={bookings}
          totalCount={7}
          empty={`No ${label.toLowerCase()} bookings.`}
        />,
      );

      const group = screen.getByRole("group", { name: label });
      expect(group).toHaveClass(accent);
      expect(
        group.querySelectorAll('a[href^="/bookings/preview-"]'),
      ).toHaveLength(3);
      expect(
        within(group).getByText(
          "A deliberately long booking title that wraps safely",
        ),
      ).toHaveClass("break-words");
      expect(within(group).getByText(viewAll)).toBeVisible();
      expect(
        within(group).getByRole("link", {
          name: `View all 7 ${noun} bookings`,
        }),
      ).toHaveAttribute("href", href);
    },
  );

  it("renders the low-emphasis today navigation", () => {
    render(<ViewTodayBookingsLink />);

    const link = screen.getByRole("link", {
      name: "View today's bookings",
    });
    expect(link).toHaveAttribute("href", "/bookings?filter=today");
    expect(link).toHaveClass("bg-primary/[0.03]", "text-primary");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
