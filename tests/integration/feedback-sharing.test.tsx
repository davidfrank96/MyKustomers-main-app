import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import {
  buildFeedbackShareMessage,
  buildFeedbackShareTitle,
} from "@/features/feedback/share";

const feedbackUrl = "https://app.example.com/f/controlled-feedback-token";

function renderFeedbackShare(recordShare = vi.fn(async () => undefined)) {
  render(
    <CustomerConfirmationShare
      businessName="Bella Cakes"
      customerName="David Okafor"
      confirmationUrl={feedbackUrl}
      recordShare={recordShare}
      initialMessage={buildFeedbackShareMessage({
        businessName: "Bella Cakes",
        customerName: "David Okafor",
      })}
      shareTitle={buildFeedbackShareTitle("Bella Cakes")}
      triggerLabel="Share feedback request"
      dialogTitle="Share feedback request"
      linkLabel="Feedback link"
      messageHelp="The secure feedback link will be included automatically."
      idPrefix="feedback-test"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share feedback request" }));
  return recordShare;
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("feedback sharing", () => {
  it("renders private contextual copy and retains fallback share actions", () => {
    renderFeedbackShare();

    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toMatch(
      /Hi David,.+private feedback.+No account is required/s,
    );
    expect(screen.getByLabelText("Feedback link")).toHaveValue(feedbackUrl);
    expect(screen.queryByRole("button", { name: "Share..." })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("copies edited feedback copy and the controlled link separately", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const recordShare = renderFeedbackShare();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Please share private feedback." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Please share private feedback.\n\n${feedbackUrl}`,
      ),
    );
    expect(recordShare).toHaveBeenCalledWith("copy_message");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(feedbackUrl));
    expect(recordShare).toHaveBeenCalledWith("copy_link");
  });

  it("uses the feedback title for native share", async () => {
    const nativeShare = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: nativeShare,
    });
    const recordShare = renderFeedbackShare();

    fireEvent.click(await screen.findByRole("button", { name: "Share..." }));
    await waitFor(() =>
      expect(nativeShare).toHaveBeenCalledWith({
        title: "Share private feedback with Bella Cakes",
        text: expect.stringContaining("private feedback"),
        url: feedbackUrl,
      }),
    );
    expect(recordShare).toHaveBeenCalledWith("native_share");
  });

  it("opens an encoded WhatsApp intent and records the selected method", () => {
    const replace = vi.fn();
    const popup = { opener: window, location: { replace } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const recordShare = renderFeedbackShare();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    const intent = new URL(replace.mock.calls[0][0]);
    expect(intent.origin).toBe("https://wa.me");
    expect(intent.searchParams.get("text")).toContain(feedbackUrl);
    expect(recordShare).toHaveBeenCalledWith("whatsapp");
    expect(popup.opener).toBeNull();
  });
});
