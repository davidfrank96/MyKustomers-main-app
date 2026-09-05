import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationLinkPanel } from "@/components/forms/confirmation-link-panel";
import {
  initialConfirmationLinkActionState,
  type ConfirmationLinkActionState,
} from "@/features/confirmation-links/action-state";
import type { ConfirmationLinkSummary } from "@/features/confirmation-links/queries";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";
import type { ProviderDeliverySummary } from "@/features/provider-delivery/model";

type LinkAction = (
  previousState: ConfirmationLinkActionState,
  formData: FormData,
) => Promise<ConfirmationLinkActionState>;

type RecordShareAction = (
  confirmationLinkId: string,
  method: ConfirmationShareMethod,
) => Promise<void>;

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
  requestRecipientEmail: null,
  requestEmailStatus: null,
  requestCreatedAt: null,
  firstOpenedAt: "2026-08-26T10:04:00.000Z",
  sharedAt: null,
  shareMethod: null,
};

function renderPanel(
  customerProfileEmail: string | null,
  options: {
    panelSummary?: ConfirmationLinkSummary;
    canManage?: boolean;
    generateAction?: LinkAction;
    revokeAction?: LinkAction;
    sendAction?: LinkAction;
    recordShareAction?: RecordShareAction;
    providerDelivery?: ProviderDeliverySummary;
  } = {},
) {
  const generateAction = vi.fn(
    options.generateAction ?? (async () => initialConfirmationLinkActionState),
  );
  const revokeAction = vi.fn(
    options.revokeAction ?? (async () => initialConfirmationLinkActionState),
  );
  const recordShareAction = vi.fn(options.recordShareAction ?? (async () => undefined));
  const sendAction = vi.fn(
    options.sendAction ?? (async () => initialConfirmationLinkActionState),
  );

  render(
    <ConfirmationLinkPanel
      summary={options.panelSummary ?? summary}
      providerDelivery={options.providerDelivery}
      canManage={options.canManage ?? false}
      businessName="Test business"
      customerName="Test customer"
      customerProfileEmail={customerProfileEmail}
      generateAction={generateAction}
      sendAction={sendAction}
      revokeAction={revokeAction}
      recordShareAction={recordShareAction}
    />,
  );

  return { generateAction, revokeAction, sendAction, recordShareAction };
}

describe("confirmation contact evidence", () => {
  it.each([
    ["DELIVERED", "Provider reported delivery"],
    ["DEFERRED", "Delivery delayed"],
    ["SOFT_BOUNCED", "Email could not be delivered after temporary attempts"],
    ["HARD_BOUNCED", "Email could not be delivered"],
    ["INVALID", "Email could not be delivered"],
    ["BLOCKED", "Email sending is unavailable for this address"],
    ["COMPLAINT", "Email sending is unavailable for this address"],
    ["PROVIDER_ERROR", "Provider reported a delivery error"],
  ] as const)("shows compact %s provider evidence without removing sharing", (status, copy) => {
    renderPanel(null, {
      panelSummary: {
        ...summary,
        status: "active",
        usedAt: null,
        confirmedAt: null,
        requestRecipientEmail: "controlled@example.com",
        requestCreatedAt: "2026-08-26T10:00:00.000Z",
      },
      canManage: true,
      providerDelivery: {
        outbox_status: "SENT",
        development_adapter: false,
        provider_delivery_status: status,
        provider_event_at: "2026-08-26T10:02:00.000Z",
        reason_category: status === "DELIVERED" ? "NONE" : "PROVIDER_ERROR",
        evidence_received_at: "2026-08-26T10:02:01.000Z",
      },
    });

    expect(screen.getByText(copy)).toBeVisible();
    expect(screen.getByRole("button", { name: "Regenerate link" })).toBeVisible();
  });

  it("lets customer confirmation outrank earlier transport failure", () => {
    renderPanel(null, {
      providerDelivery: {
        outbox_status: "SENT",
        development_adapter: false,
        provider_delivery_status: "HARD_BOUNCED",
        provider_event_at: "2026-08-26T10:02:00.000Z",
        reason_category: "PERMANENT_DELIVERY_FAILURE",
        evidence_received_at: "2026-08-26T10:02:01.000Z",
      },
      panelSummary: {
        ...summary,
        requestRecipientEmail: "controlled@example.com",
        requestCreatedAt: "2026-08-26T10:00:00.000Z",
      },
    });
    expect(screen.getByText("Customer confirmed")).toBeVisible();
    expect(screen.getByText("Email delivery: Email could not be delivered")).toBeVisible();
    expect(screen.queryByText("The address may be incorrect or unavailable.")).toBeNull();
  });

  it("distinguishes a booking email from a different saved contact email", () => {
    renderPanel("old@example.com");

    expect(screen.getByText("Customer email")).toBeVisible();
    expect(screen.getByText("new@example.com")).toBeVisible();
    expect(screen.getByText(/Saved contact email/)).toBeVisible();
    expect(screen.getByText("old@example.com")).toBeVisible();
  });

  it("does not duplicate the same normalized profile email", () => {
    renderPanel(" new@EXAMPLE.COM ");

    expect(screen.getByText("Customer email")).toBeVisible();
    expect(screen.queryByText(/Saved contact email/)).toBeNull();
  });

  it("keeps a saved contact separate until Use saved email is selected", () => {
    renderPanel("Saved.Person@EXAMPLE.COM", {
      panelSummary: {
        ...summary,
        status: "active",
        usedAt: null,
        confirmedAt: null,
        contactEmail: null,
        requestRecipientEmail: null,
      },
      canManage: true,
    });

    expect(screen.getByText("No customer email added")).toBeVisible();
    const disclosure = screen.getByRole("button", { name: /Custom email/ });
    fireEvent.click(disclosure);
    const recipient = screen.getByLabelText("Customer email");
    expect(recipient).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Use saved email" }));
    expect(recipient).toHaveValue("Saved.Person@example.com");
    expect(recipient).toHaveFocus();
  });

  it("renders status and every existing confirmation metadata field", () => {
    renderPanel("old@example.com");

    expect(screen.getByText("Customer confirmed")).toBeVisible();
    for (const label of [
      "Status",
      "Created",
      "Expires",
      "Confirmed",
      "Last share action",
      "First viewed",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText("Not shared from My Kustomers")).toBeVisible();
  });

  it("keeps regenerate and revoke wired to their existing form actions", async () => {
    const activeSummary: ConfirmationLinkSummary = {
      ...summary,
      status: "active",
      usedAt: null,
      confirmedAt: null,
    };
    const { generateAction, revokeAction } = renderPanel("new@example.com", {
      panelSummary: activeSummary,
      canManage: true,
    });

    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("An active confirmation link exists.")).toBeVisible();
    expect(
      screen.getByText(
        "The exact secure link is no longer available here. Regenerate it to create a fresh shareable link.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Share with customer" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Generate confirmation link" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate link" }));
    await waitFor(() => expect(generateAction).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    await waitFor(() => expect(revokeAction).toHaveBeenCalledTimes(1));
  });

  it("shows the established share flow after generation without visibly exposing the token", async () => {
    const confirmationUrl = "https://app.example.com/c/controlled-token";
    const activeSummary: ConfirmationLinkSummary = {
      ...summary,
      status: "active",
      usedAt: null,
      confirmedAt: null,
    };
    const generateAction = vi.fn(async () => ({
      status: "success" as const,
      message: "Confirmation link generated.",
      confirmationUrl,
      confirmationLinkId: "00000000-0000-4000-8000-000000000002",
    }));
    renderPanel(null, {
      panelSummary: activeSummary,
      canManage: true,
      generateAction,
      sendAction: vi.fn(async () => initialConfirmationLinkActionState),
    });

    fireEvent.click(screen.getByRole("button", { name: "Regenerate link" }));
    expect(await screen.findByText("Your confirmation request is ready.")).toBeVisible();
    const generatedLink = screen.getByLabelText("Generated confirmation link");
    expect(generatedLink).toHaveClass("sr-only");
    expect(document.body).not.toHaveTextContent("controlled-token");
    expect(screen.getAllByText("Confirmation link generated.")).toHaveLength(1);
    expect(screen.queryByText("An active confirmation link exists.")).toBeNull();
    const share = screen.getByRole("button", { name: "Share with customer" });
    const customEmail = screen.getByRole("button", { name: /Custom email/ });
    expect(share).toBeVisible();
    expect(share).toHaveClass("w-full", "whitespace-nowrap");
    expect(screen.getByText("OR")).toBeVisible();
    expect(customEmail).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Customer email")).not.toBeVisible();
  });

  it("shows only generation before any confirmation link exists", () => {
    renderPanel(null, {
      panelSummary: {
        ...summary,
        id: "",
        status: "none",
        createdAt: null,
        expiresAt: null,
        usedAt: null,
        confirmedAt: null,
        contactEmail: null,
        firstOpenedAt: null,
      },
      canManage: true,
    });

    expect(screen.getByText("No confirmation link generated yet.")).toBeVisible();
    const generate = screen.getByRole("button", {
      name: "Generate confirmation link",
    });
    expect(generate).toBeVisible();
    expect(generate).toHaveClass("w-full", "whitespace-nowrap");
    expect(
      screen.queryByRole("button", { name: "Share with customer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Regenerate link" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke link" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Custom email" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the editable confirmation recipient in a reversible Custom email disclosure", async () => {
    const sendAction = vi.fn<LinkAction>(async () => ({
      status: "success",
      message: "Email accepted for delivery to Updated.Person@hotmail.com.",
      recipientEmail: "Updated.Person@hotmail.com",
      deliveryStatus: "accepted",
    }));
    renderPanel("Original.Person@EXAMPLE.COM", {
      panelSummary: {
        ...summary,
        status: "active",
        usedAt: null,
        confirmedAt: null,
        contactEmail: null,
        requestRecipientEmail: "Original.Person@example.com",
        requestEmailStatus: "FAILED",
        requestCreatedAt: "2026-08-26T10:00:00.000Z",
      },
      canManage: true,
      sendAction,
    });

    const disclosure = screen.getByRole("button", { name: /Custom email/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Customer email")).not.toBeVisible();

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    const recipient = screen.getByLabelText("Customer email");
    expect(recipient).toBeVisible();
    expect(recipient).toHaveValue("Original.Person@example.com");
    fireEvent.change(recipient, {
      target: { value: "Updated.Person@HOTMAIL.COM" },
    });
    fireEvent.blur(recipient);
    expect(recipient).toHaveValue("Updated.Person@hotmail.com");

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(recipient).not.toBeVisible();
    fireEvent.click(disclosure);
    expect(recipient).toBeVisible();
    expect(recipient).toHaveValue("Updated.Person@hotmail.com");

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation email" }));

    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    expect(sendAction.mock.calls[0]?.[1].get("recipientEmail")).toBe(
      "Updated.Person@hotmail.com",
    );
    expect(
      await screen.findByText(
        "Email accepted for delivery to Updated.Person@hotmail.com.",
      ),
    ).toBeVisible();
  });

  it("keeps Custom email open and focuses its field after a safe validation error", async () => {
    const sendAction = vi.fn<LinkAction>(async () => ({
      status: "error",
      message: "Check the recipient email before sending.",
      fieldErrors: { recipientEmail: ["Enter a valid email address."] },
    }));
    renderPanel("customer@example.com", {
      panelSummary: {
        ...summary,
        status: "active",
        usedAt: null,
        confirmedAt: null,
      },
      canManage: true,
      sendAction,
    });

    const disclosure = screen.getByRole("button", { name: /Custom email/ });
    fireEvent.click(disclosure);
    const recipient = screen.getByLabelText("Customer email");
    fireEvent.change(recipient, { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation email" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
    await waitFor(() => expect(disclosure).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(recipient).toHaveFocus());
  });

  it.each(["revoked", "expired"] as const)(
    "offers fresh generation without active-link actions when %s",
    (status) => {
      renderPanel(null, {
        panelSummary: {
          ...summary,
          status,
          usedAt: null,
          revokedAt: status === "revoked" ? "2026-08-26T11:00:00.000Z" : null,
          confirmedAt: null,
          contactEmail: null,
        },
        canManage: true,
      });

      expect(
        screen.getByRole("button", { name: "Generate new confirmation link" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Share with customer" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Regenerate link" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Revoke link" }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows confirmation evidence without reopening link controls", () => {
    renderPanel("new@example.com", { panelSummary: summary, canManage: false });

    expect(screen.getByText("Customer confirmed")).toBeVisible();
    expect(
      screen.getByText("Customer confirmation is recorded for this booking."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /confirmation link/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share with customer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
  });

  it("removes the one-time Share card when authoritative state becomes revoked", async () => {
    const confirmationUrl = "https://app.example.com/c/controlled-token";
    const activeSummary: ConfirmationLinkSummary = {
      ...summary,
      status: "active",
      usedAt: null,
      confirmedAt: null,
    };
    const generateAction = vi.fn(async () => ({
      status: "success" as const,
      message: "Confirmation link generated.",
      confirmationUrl,
      confirmationLinkId: "00000000-0000-4000-8000-000000000002",
    }));
    const commonProps = {
      canManage: true,
      businessName: "Test business",
      customerName: "Test customer",
      customerProfileEmail: null,
      generateAction,
      sendAction: vi.fn(async () => initialConfirmationLinkActionState),
      revokeAction: vi.fn(async () => initialConfirmationLinkActionState),
      recordShareAction: vi.fn(async () => undefined),
    };
    const { rerender } = render(
      <ConfirmationLinkPanel summary={activeSummary} {...commonProps} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Regenerate link" }));
    expect(
      await screen.findByRole("button", { name: "Share with customer" }),
    ).toBeVisible();

    rerender(
      <ConfirmationLinkPanel
        summary={{
          ...activeSummary,
          status: "revoked",
          revokedAt: "2026-08-26T11:00:00.000Z",
        }}
        {...commonProps}
      />,
    );

    expect(screen.queryByRole("button", { name: "Share with customer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generate new confirmation link" }),
    ).toBeVisible();
  });
});
