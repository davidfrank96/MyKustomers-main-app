import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";

const confirmationUrl = "https://app.example.com/c/controlled-token";

function renderShare(recordShare = vi.fn(async () => undefined)) {
  render(
    <ToastProvider>
      <CustomerConfirmationShare
        businessName="Bella Cakes"
        customerName="David Okafor"
        confirmationUrl={confirmationUrl}
        recordShare={recordShare}
      />
      <ToastViewport />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share with customer" }));
  return recordShare;
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("CustomerConfirmationShare", () => {
  it("renders an editable contextual message while keeping the URL read-only", () => {
    renderShare();

    const message = screen.getByLabelText("Message");
    const link = screen.getByLabelText("Confirmation link");
    expect((message as HTMLTextAreaElement).value).toContain("Hi David, Bella Cakes");
    fireEvent.change(message, { target: { value: "Please review this order." } });
    expect(message).toHaveValue("Please review this order.");
    expect(link).toHaveValue(confirmationUrl);
    expect(link).toHaveAttribute("readonly");
  });

  it("copies the edited message with the controlled link", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const recordShare = renderShare();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Please review this order." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Please review this order.\n\n${confirmationUrl}`,
      ),
    );
    expect(recordShare).toHaveBeenCalledWith("copy_message");
    expect(await screen.findByText("Message copied")).toBeInTheDocument();
  });

  it("copies only the controlled link", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const recordShare = renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(confirmationUrl));
    expect(recordShare).toHaveBeenCalledWith("copy_link");
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("uses native sharing when supported and ignores user cancellation", async () => {
    const nativeShare = vi.fn(async () => {
      throw new DOMException("Cancelled", "AbortError");
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: nativeShare,
    });
    const recordShare = renderShare();
    const shareButton = await screen.findByRole("button", { name: "Share..." });
    fireEvent.click(shareButton);

    await waitFor(() =>
      expect(nativeShare).toHaveBeenCalledWith({
        title: "Review your order with Bella Cakes",
        text: expect.stringContaining("Hi David, Bella Cakes"),
        url: confirmationUrl,
      }),
    );
    expect(recordShare).toHaveBeenCalledWith("native_share");
    expect(screen.queryByText("Could not open sharing options")).not.toBeInTheDocument();
  });

  it("keeps fallback actions when native sharing is unsupported", () => {
    renderShare();

    expect(screen.queryByRole("button", { name: "Share..." })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("opens encoded WhatsApp and Telegram intents and records method selection", () => {
    const replace = vi.fn();
    const popup = {
      opener: window,
      location: { replace },
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const recordShare = renderShare();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(new URL(replace.mock.calls[0][0]).origin).toBe("https://wa.me");
    expect(recordShare).toHaveBeenCalledWith("whatsapp");

    fireEvent.click(screen.getByRole("button", { name: "Telegram" }));
    expect(new URL(replace.mock.calls[1][0]).origin).toBe("https://t.me");
    expect(recordShare).toHaveBeenCalledWith("telegram");
    expect(popup.opener).toBeNull();
  });

  it("surfaces a blocked external sharing window", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const recordShare = renderShare();
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(await screen.findByText("Sharing window blocked")).toBeInTheDocument();
    expect(recordShare).not.toHaveBeenCalledWith("whatsapp");
  });

  it("surfaces clipboard failures without changing the controlled link", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => Promise.reject(new Error("Denied"))) },
    });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Could not copy")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmation link")).toHaveValue(confirmationUrl);
  });
});
