import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

describe("WorkspacePageSkeleton", () => {
  it.each(["dashboard", "list", "detail", "form"] as const)(
    "provides an accessible, non-interactive %s loading region",
    (variant) => {
      const { container } = render(
        <WorkspacePageSkeleton label={`Loading ${variant}`} variant={variant} />,
      );
      const status = screen.getByRole("status");

      expect(status).toHaveAttribute("aria-busy", "true");
      expect(status).toHaveTextContent(`Loading ${variant}`);
      expect(status).toHaveClass("overflow-hidden");
      expect(
        container.querySelectorAll("a, button, input, select, textarea"),
      ).toHaveLength(0);
      expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    },
  );

  it("renders destination identity without introducing interactive placeholder controls", () => {
    render(
      <WorkspacePageSkeleton
        label="Loading bookings"
        title="Bookings"
        description="Loading current business bookings."
        variant="list"
      />,
    );

    expect(screen.getByRole("heading", { name: "Bookings" })).toBeVisible();
    expect(screen.getByText("Loading current business bookings.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
