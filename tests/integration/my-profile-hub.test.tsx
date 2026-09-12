import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MyProfileHub,
  MyProfileHubSkeleton,
} from "@/components/businesses/my-profile-hub";

const business = {
  name: "Cedar Workshop",
  category: "Repairs",
  logoUrl: "/existing-business-logo.webp",
  createdAt: "2025-02-01T00:30:00+01:00",
};

describe("My Profile presentation and existing-feature mapping", () => {
  it("uses supplied identity and labels the existing creation timestamp truthfully in UTC", () => {
    const { container } = render(<MyProfileHub business={business} isOwner />);

    expect(screen.getByRole("heading", { level: 2, name: business.name })).toBeVisible();
    expect(screen.getByText(business.category)).toBeVisible();
    expect(screen.getByText("Active", { exact: true })).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", business.logoUrl);
    expect(container.querySelector("time")).toHaveTextContent("Jan 2025");
    expect(container.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2025-01-31T23:30:00.000Z",
    );
    expect(screen.getByText(/Created/)).toBeVisible();
    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });

  it("wires only implemented destinations and keeps the other five rows static", () => {
    const { container } = render(<MyProfileHub business={business} isOwner />);

    for (const name of ["Business", "Account", "Billing & Legal"]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getAllByRole("listitem")).toHaveLength(3);
      expect(within(section).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(
      container.querySelectorAll("form, input, select, textarea, [tabindex]"),
    ).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    for (const [name, href] of [
      ["Edit", "/business/edit?section=information"],
      ["Business information", "/business/edit?section=information"],
      ["Contact information", "/business/edit?section=contact"],
      ["Business address", "/business/edit?section=address"],
      ["Notifications", "/settings#notifications"],
    ])
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    for (const name of [
      "Account details",
      "Privacy & security",
      "Billing & subscriptions",
      "Terms & conditions",
      "About MyKustomers",
    ]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name, level: 3 }).closest("li"),
      ).not.toHaveAttribute("tabindex");
    }
    for (const icon of container.querySelectorAll("svg"))
      expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("does not advertise an available Edit action to members", () => {
    render(<MyProfileHub business={business} isOwner={false} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Business information" })).toBeVisible();
  });

  it.each([null, "not-a-date"])(
    "omits unavailable optional data (%s) and preserves the existing initials fallback",
    (createdAt) => {
      const { container } = render(
        <MyProfileHub
          isOwner
          business={{ ...business, logoUrl: null, category: "", createdAt }}
        />,
      );

      expect(screen.getByLabelText("Cedar Workshop logo")).toHaveTextContent("CW");
      expect(container.querySelectorAll("img, time")).toHaveLength(0);
      expect(screen.queryByText(business.category)).not.toBeInTheDocument();
      expect(screen.queryByText(/Created|Member since/)).not.toBeInTheDocument();
    },
  );

  it("retains the existing broken-image recovery without distorting or substituting a logo", () => {
    const { container } = render(<MyProfileHub business={business} isOwner />);
    const image = container.querySelector("img")!;
    expect(image).toHaveClass("object-contain");
    fireEvent.error(image);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cedar Workshop logo")).toHaveTextContent("CW");
  });

  it("announces loading without exposing fictional identity or interactive skeletons", () => {
    const { container } = render(<MyProfileHubSkeleton />);
    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading business");
    expect(container.querySelectorAll("a, button, input, time")).toHaveLength(0);
    expect(screen.queryByText(business.name)).not.toBeInTheDocument();
  });
});
