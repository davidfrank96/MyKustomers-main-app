import fs from "node:fs";
import { describe, expect, it } from "vitest";

const targetPaths = [
  "app/(dashboard)/dashboard/page.tsx",
  "app/(dashboard)/bookings/page.tsx",
  "app/(dashboard)/bookings/[bookingId]/page.tsx",
  "app/(dashboard)/customers/page.tsx",
  "features/analytics/components/insights-view.tsx",
  "app/(dashboard)/business/page.tsx",
  "app/(dashboard)/business/new/page.tsx",
  "app/(dashboard)/onboarding/page.tsx",
];

const targetSource = targetPaths.map((path) => fs.readFileSync(path, "utf8")).join("\n");
const businessWorkspaceSource = fs.readFileSync(
  "components/businesses/business-workspace.tsx",
  "utf8",
);
const businessPresentationSource = `${businessWorkspaceSource}\n${fs.readFileSync(
  "components/forms/business-onboarding-form.tsx",
  "utf8",
)}`;
const buttonSource = fs.readFileSync("components/ui/button.tsx", "utf8");
const globalStyles = fs.readFileSync("app/globals.css", "utf8");

describe("mobile redesign scope policy", () => {
  it("uses the shared mobile page language across every approved target", () => {
    for (const path of targetPaths) {
      expect(fs.readFileSync(path, "utf8"), path).toContain("WorkspacePage");
    }
  });

  it("keeps unsupported generated concepts out of the redesigned screens", () => {
    for (const unsupported of [
      "Business hours",
      "Team management",
      "Roles and permissions",
      "Top services",
      "Payment verified",
    ]) {
      expect(targetSource).not.toContain(unsupported);
    }
  });

  it("keeps booking quick filters progressive while retaining lifecycle filters", () => {
    const bookings = fs.readFileSync("app/(dashboard)/bookings/page.tsx", "utf8");

    expect(bookings).toContain('["all", "active", "today", "upcoming", "overdue"]');
    expect(bookings).toContain("bookingListFilters.slice(5)");
    expect(bookings).toContain("More statuses");
  });

  it("preserves the real 5 MB business-logo source policy in the shared flow", () => {
    const logoForm = fs.readFileSync(
      "components/forms/business-logo-form.tsx",
      "utf8",
    );

    expect(logoForm).toContain("PNG, JPEG, or WebP up to 5 MB");
    expect(logoForm).toContain("Saved as a WebP no larger than 512px and 200");
  });

  it("keeps the Business precision pass compact and within existing capabilities", () => {
    for (const label of [
      "Current business",
      "Switch business",
      "Business details",
      "Business information",
      "Contact information",
      "Business address",
      "Add another business",
    ]) {
      expect(businessPresentationSource).toContain(label);
    }

    for (const unsupported of [
      "Business hours",
      "Team members",
      "Subscription",
      "Billing",
      "Integrations",
      "Staff management",
    ]) {
      expect(businessPresentationSource).not.toContain(unsupported);
    }
  });

  it("keeps filled primary controls on the shared high-contrast foreground", () => {
    expect(buttonSource).toContain("bg-primary text-primary-foreground");
    expect(globalStyles).not.toContain("color: inherit;");
  });
});
