import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationLinkPanel } from "@/components/forms/confirmation-link-panel";
import { initialConfirmationLinkActionState } from "@/features/confirmation-links/action-state";
import type { ConfirmationLinkSummary } from "@/features/confirmation-links/queries";

const summary: ConfirmationLinkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "used",
  createdAt: "2026-08-26T10:00:00.000Z",
  expiresAt: "2026-08-27T10:00:00.000Z",
  usedAt: "2026-08-26T10:05:00.000Z",
  revokedAt: null,
  confirmedAt: "2026-08-26T10:05:00.000Z",
  contactEmail: "new@example.com",
  contactPhone: null,
  emailStatus: "SENT",
  firstOpenedAt: "2026-08-26T10:04:00.000Z",
  sharedAt: null,
  shareMethod: null,
};

function renderPanel(customerProfileEmail: string | null) {
  render(
    <ConfirmationLinkPanel
      summary={summary}
      canManage={false}
      businessName="Test business"
      customerName="Test customer"
      customerProfileEmail={customerProfileEmail}
      generateAction={vi.fn(async () => initialConfirmationLinkActionState)}
      revokeAction={vi.fn(async () => initialConfirmationLinkActionState)}
      recordShareAction={vi.fn(async () => undefined)}
    />,
  );
}

describe("confirmation contact evidence", () => {
  it("distinguishes a booking contact from a different customer profile email", () => {
    renderPanel("old@example.com");

    expect(screen.getByText("Booking contact")).toBeVisible();
    expect(screen.getByText("new@example.com")).toBeVisible();
    expect(screen.getByText("Customer profile email")).toBeVisible();
    expect(screen.getByText("old@example.com")).toBeVisible();
  });

  it("does not duplicate the same normalized profile email", () => {
    renderPanel(" NEW@example.com ");

    expect(screen.getByText("Booking contact")).toBeVisible();
    expect(screen.queryByText("Customer profile email")).toBeNull();
  });
});
