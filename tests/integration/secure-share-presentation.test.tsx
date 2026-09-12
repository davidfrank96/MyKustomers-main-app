import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import {
  buildFeedbackShareMessage,
  buildFeedbackShareTitle,
} from "@/features/feedback/share";

const variants = ["feedback", "confirmation"] as const;
type Variant = (typeof variants)[number];

function shareProps(
  variant: Variant,
  businessName = "Bella Cakes",
  customerName = "David Okafor",
) {
  const feedback = variant === "feedback";
  return {
    presentation: variant,
    businessName,
    customerName,
    confirmationUrl: `https://app.example.com/${feedback ? "f" : "c"}/controlled-${businessName.replaceAll(" ", "-")}`,
    triggerLabel: `Share ${variant} for ${businessName}`,
    dialogTitle: feedback ? "Share feedback request" : "Share with customer",
    linkLabel: feedback ? "Feedback link" : "Confirmation link",
    idPrefix: `${variant}-${businessName.replaceAll(" ", "-")}`,
    messageHelp:
      "You can edit this message before sharing. The secure link will be included automatically.",
    ...(feedback
      ? {
          initialMessage: buildFeedbackShareMessage({ businessName, customerName }),
          shareTitle: buildFeedbackShareTitle(businessName),
        }
      : {}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("secure-share presentation regression", () => {
  it("keeps both link families and two businesses/customers isolated across every channel", async () => {
    const writeText = vi.fn(async () => undefined);
    const nativeShare = vi.fn(async () => undefined);
    const replace = vi.fn();
    const popup = { opener: window, location: { replace } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
    const persist = vi.spyOn(Storage.prototype, "setItem");
    const contexts = variants.flatMap((variant) =>
      [
        shareProps(variant, "Bella Cakes", "David Okafor"),
        shareProps(variant, "Garden Studio", "Ada Williams"),
      ].map((props) => ({
        props,
        recordShare: vi.fn<(method: string) => Promise<void>>(async () => undefined),
      })),
    );
    render(
      <>
        {contexts.map(({ props, recordShare }) => (
          <CustomerConfirmationShare
            key={props.idPrefix}
            {...props}
            recordShare={recordShare}
          />
        ))}
      </>,
    );

    for (const { props, recordShare } of contexts) {
      const trigger = screen.getByRole("button", { name: props.triggerLabel });
      fireEvent.click(trigger);
      const dialog = within(screen.getByRole("dialog", { name: props.dialogTitle }));
      const initial = (dialog.getByLabelText("Message") as HTMLTextAreaElement).value;
      expect(initial).toContain(props.customerName.split(" ")[0]);
      expect(initial).toContain(props.businessName);
      expect(initial.includes("private feedback")).toBe(
        props.presentation === "feedback",
      );
      expect(recordShare).not.toHaveBeenCalled();
      const message = `  ${props.customerName}: ${props.businessName} & tea 🍰?\nPlease reply.  `;
      fireEvent.change(dialog.getByLabelText("Message"), { target: { value: message } });
      expect(dialog.getByLabelText(props.linkLabel)).toHaveValue(props.confirmationUrl);

      fireEvent.click(dialog.getByRole("button", { name: "WhatsApp" }));
      const whatsapp = new URL(replace.mock.lastCall![0]);
      expect(whatsapp.origin).toBe("https://wa.me");
      expect(whatsapp.searchParams.get("text")).toBe(
        `${message.trim()}\n\n${props.confirmationUrl}`,
      );
      fireEvent.click(dialog.getByRole("button", { name: "Telegram" }));
      const telegram = new URL(replace.mock.lastCall![0]);
      expect(telegram.origin).toBe("https://t.me");
      expect(telegram.searchParams.get("text")).toBe(message.trim());
      expect(telegram.searchParams.get("url")).toBe(props.confirmationUrl);
      expect(popup.opener).toBeNull();

      fireEvent.click(dialog.getByRole("button", { name: "Share..." }));
      expect(nativeShare).toHaveBeenLastCalledWith({
        title: props.shareTitle ?? `Review your order with ${props.businessName}`,
        text: message.trim(),
        url: props.confirmationUrl,
      });
      fireEvent.click(dialog.getByRole("button", { name: "Copy message" }));
      await waitFor(() =>
        expect(writeText).toHaveBeenLastCalledWith(
          `${message.trim()}\n\n${props.confirmationUrl}`,
        ),
      );
      fireEvent.click(dialog.getByRole("button", { name: "Copy link" }));
      await waitFor(() =>
        expect(writeText).toHaveBeenLastCalledWith(props.confirmationUrl),
      );
      fireEvent.click(
        dialog.getByRole("button", {
          name: `Copy ${props.presentation} link`,
        }),
      );
      await waitFor(() => expect(recordShare).toHaveBeenCalledTimes(6));
      expect(recordShare.mock.calls.map((call) => call[0])).toEqual([
        "whatsapp",
        "telegram",
        "native_share",
        "copy_message",
        "copy_link",
        "copy_link",
      ]);
      fireEvent.click(dialog.getAllByRole("button", { name: "Close" }).at(-1)!);
      fireEvent.click(trigger);
      expect(screen.getByLabelText("Message")).toHaveValue(message);
      expect(screen.getByLabelText(props.linkLabel)).toHaveValue(props.confirmationUrl);
      expect(recordShare).toHaveBeenCalledTimes(6);
      fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    }
    expect(persist).not.toHaveBeenCalled();
  });

  it.each(variants)(
    "uses the real existing message limit and accessible labels for %s",
    (variant) => {
      const props = shareProps(variant);
      render(<CustomerConfirmationShare {...props} recordShare={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: props.triggerLabel }));
      expect(screen.getByRole("dialog", { name: props.dialogTitle })).toHaveAttribute(
        "aria-modal",
        "true",
      );
      const message = screen.getByLabelText("Message");
      expect(message).toHaveAttribute("maxlength", "1200");
      expect(message).toHaveAccessibleDescription(props.messageHelp);
      fireEvent.change(message, { target: { value: "Hello 🍰" } });
      expect(screen.getByText("8/1200")).toBeInTheDocument();
      expect(screen.getByLabelText(props.linkLabel)).toHaveAttribute("readonly");
      fireEvent.change(message, { target: { value: "x".repeat(1200) } });
      expect(screen.getByText("1200/1200")).toBeInTheDocument();
    },
  );

  it.each(variants)(
    "retains native-share error feedback and an unchanged %s URL",
    async (variant) => {
      const props = shareProps(variant);
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: vi.fn(async () => {
          throw new Error("Unavailable");
        }),
      });
      const recordShare = vi.fn(async () => undefined);
      render(<CustomerConfirmationShare {...props} recordShare={recordShare} />);
      fireEvent.click(screen.getByRole("button", { name: props.triggerLabel }));
      fireEvent.click(screen.getByRole("button", { name: "Share..." }));
      expect(
        await screen.findByText("Could not open sharing options"),
      ).toBeInTheDocument();
      expect(recordShare).toHaveBeenCalledWith("native_share");
      expect(screen.getByLabelText(props.linkLabel)).toHaveValue(props.confirmationUrl);
    },
  );

  it.each(variants)(
    "preserves clipboard fallback and removes its temporary %s field",
    async (variant) => {
      const props = shareProps(variant);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      const copy = vi.fn(() => true);
      Object.defineProperty(document, "execCommand", { configurable: true, value: copy });
      const recordShare = vi.fn(async () => undefined);
      render(<CustomerConfirmationShare {...props} recordShare={recordShare} />);
      fireEvent.click(screen.getByRole("button", { name: props.triggerLabel }));
      fireEvent.click(screen.getByRole("button", { name: `Copy ${variant} link` }));
      expect(await screen.findByText("Link copied")).toBeInTheDocument();
      expect(copy).toHaveBeenCalledWith("copy");
      expect(recordShare).toHaveBeenCalledWith("copy_link");
      expect(document.querySelectorAll("textarea")).toHaveLength(1);
      expect(screen.getByLabelText(props.linkLabel)).toHaveValue(props.confirmationUrl);
    },
  );

  it("leaves the legacy presentation available to amendment and add-on callers", () => {
    render(
      <CustomerConfirmationShare
        businessName="Bella Cakes"
        customerName="David"
        confirmationUrl="https://app.example.com/a/controlled"
        recordShare={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share with customer" }));
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
    expect(screen.queryByText("Share via")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
