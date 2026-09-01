import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackLinkPanel } from "@/components/forms/feedback-link-panel";
import {
  initialFeedbackLinkActionState,
  type FeedbackLinkActionState,
} from "@/features/feedback/action-state";
import type { FeedbackLinkSummary } from "@/features/feedback/queries";
import type { FeedbackShareMethod } from "@/features/feedback/share";

type LinkAction = (
  previousState: FeedbackLinkActionState,
  formData: FormData,
) => Promise<FeedbackLinkActionState>;

type RecordShareAction = (
  feedbackLinkId: string,
  method: FeedbackShareMethod,
) => Promise<void>;

const noneSummary: FeedbackLinkSummary = {
  id: "",
  status: "none",
  createdAt: null,
  expiresAt: null,
  submittedAt: null,
  firstOpenedAt: null,
  sharedAt: null,
  shareMethod: null,
};

const activeSummary: FeedbackLinkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "active",
  createdAt: "2026-08-30T22:08:00.000Z",
  expiresAt: "2026-09-13T22:08:00.000Z",
  submittedAt: null,
  firstOpenedAt: null,
  sharedAt: null,
  shareMethod: null,
};

function renderPanel(
  options: {
    summary?: FeedbackLinkSummary;
    canManage?: boolean;
    generateAction?: LinkAction;
    revokeAction?: LinkAction;
    recordShareAction?: RecordShareAction;
  } = {},
) {
  const generateAction = vi.fn(
    options.generateAction ?? (async () => initialFeedbackLinkActionState),
  );
  const revokeAction = vi.fn(
    options.revokeAction ?? (async () => initialFeedbackLinkActionState),
  );
  const recordShareAction = vi.fn(options.recordShareAction ?? (async () => undefined));

  const view = render(
    <FeedbackLinkPanel
      summary={options.summary ?? noneSummary}
      canManage={options.canManage ?? true}
      businessName="Test business"
      customerName="Test customer"
      generateAction={generateAction}
      revokeAction={revokeAction}
      recordShareAction={recordShareAction}
    />,
  );

  return { ...view, generateAction, revokeAction, recordShareAction };
}

describe("private feedback link panel", () => {
  it("renders the complete not-requested state with only its eligible action", () => {
    renderPanel();

    expect(screen.getByText("None")).toBeVisible();
    for (const label of [
      "Status",
      "Created",
      "Expires",
      "Submitted",
      "Last share action",
      "First viewed",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText("Not shared from My Kustomers")).toBeVisible();
    const request = screen.getByRole("button", { name: "Request feedback" });
    expect(request).toBeVisible();
    expect(request).toHaveClass("w-full", "whitespace-nowrap");
    expect(
      screen.queryByRole("button", { name: "Share feedback request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share feedback" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
  });

  it("presents an active reloaded request without reconstructing its raw URL", async () => {
    const { generateAction, revokeAction } = renderPanel({ summary: activeSummary });

    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("An active feedback request exists.")).toBeVisible();
    expect(
      screen.getByText(
        "Prepare the secure request to recover the same link when available, without creating a duplicate request.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Share feedback request" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    await waitFor(() => expect(generateAction).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    await waitFor(() => expect(revokeAction).toHaveBeenCalledTimes(1));
  });

  it("shows the established share flow after generation without visibly exposing the token", async () => {
    const feedbackUrl = "https://app.example.com/f/controlled-feedback-token";
    const generateAction = vi.fn(async () => ({
      status: "success" as const,
      message: "Feedback link generated.",
      feedbackUrl,
      feedbackLinkId: "00000000-0000-4000-8000-000000000002",
    }));
    renderPanel({ summary: activeSummary, generateAction });

    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));

    expect(
      await screen.findByText("Your private feedback request is ready."),
    ).toBeVisible();
    expect(screen.getByLabelText("Generated feedback link")).toHaveClass("sr-only");
    expect(document.body).not.toHaveTextContent("controlled-feedback-token");
    expect(screen.getAllByText("Feedback link generated.")).toHaveLength(1);

    expect(screen.getByRole("button", { name: "Share feedback request" })).toHaveClass(
      "w-full",
      "whitespace-nowrap",
    );
    expect(screen.getByRole("button", { name: "Share feedback" })).toHaveClass(
      "w-full",
      "whitespace-nowrap",
    );
    expect(screen.getByRole("button", { name: "Revoke link" })).toHaveClass(
      "w-full",
      "whitespace-nowrap",
    );

    fireEvent.click(screen.getByRole("button", { name: "Share feedback request" }));
    expect(screen.getByRole("heading", { name: "Share feedback request" })).toBeVisible();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Telegram" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy message" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeVisible();
  });

  it.each(["revoked", "expired"] as const)(
    "offers a fresh request without active-link controls when %s",
    (status) => {
      renderPanel({ summary: { ...activeSummary, status } });

      expect(
        screen.getByRole("button", { name: "Request feedback again" }),
      ).toBeVisible();
      expect(screen.queryByRole("button", { name: "Share feedback request" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Share feedback" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
    },
  );

  it("shows submitted evidence without reopening request controls", () => {
    renderPanel({
      summary: {
        ...activeSummary,
        status: "submitted",
        submittedAt: "2026-08-31T00:10:00.000Z",
      },
      canManage: false,
    });

    expect(screen.getByText("Feedback submitted")).toBeVisible();
    expect(
      screen.getByText("Private feedback has been submitted for this booking."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /feedback/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
  });

  it("removes a transient Share card when authoritative state becomes revoked", async () => {
    const generateAction = vi.fn(async () => ({
      status: "success" as const,
      message: "Feedback link generated.",
      feedbackUrl: "https://app.example.com/f/controlled-feedback-token",
      feedbackLinkId: "00000000-0000-4000-8000-000000000002",
    }));
    const commonProps = {
      canManage: true,
      businessName: "Test business",
      customerName: "Test customer",
      generateAction,
      revokeAction: vi.fn(async () => initialFeedbackLinkActionState),
      recordShareAction: vi.fn(async () => undefined),
    };
    const { rerender } = render(
      <FeedbackLinkPanel summary={activeSummary} {...commonProps} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    expect(
      await screen.findByRole("button", { name: "Share feedback request" }),
    ).toBeVisible();

    rerender(
      <FeedbackLinkPanel
        summary={{ ...activeSummary, status: "revoked" }}
        {...commonProps}
      />,
    );

    expect(screen.queryByRole("button", { name: "Share feedback request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revoke link" })).toBeNull();
    expect(screen.getByRole("button", { name: "Request feedback again" })).toBeVisible();
  });
});
