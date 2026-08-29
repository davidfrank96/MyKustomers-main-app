import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceSectionHeader,
} from "@/components/layout/workspace-page";

describe("workspace page presentation", () => {
  it("keeps the page title, description, and primary action semantic", () => {
    render(
      <WorkspacePage>
        <WorkspacePageHeader
          title="Bookings"
          description="Track agreed work and delivery status."
          action={<Link href="/bookings/new">New booking</Link>}
        />
      </WorkspacePage>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
    expect(screen.getByText("Track agreed work and delivery status.")).toBeVisible();
    expect(screen.getByRole("link", { name: "New booking" })).toHaveAttribute(
      "href",
      "/bookings/new",
    );
  });

  it("renders compact section headings without changing their hierarchy", () => {
    render(
      <WorkspaceSectionHeader
        title="Needs attention"
        description="Bookings that may need action now."
        action={<Link href="/bookings">View all</Link>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Needs attention" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "View all" })).toBeVisible();
  });
});
