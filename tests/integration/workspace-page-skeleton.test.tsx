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
      expect(container.querySelectorAll("a, button, input, select, textarea")).toHaveLength(
        0,
      );
      expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    },
  );
});
