import { describe, expect, it } from "vitest";
import {
  buildCustomerConfirmationMessageText,
  buildCustomerConfirmationShareMessage,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "@/features/confirmation-links/share";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

const confirmationUrl = "https://app.example.com/c/safe-token_123";

describe("trusted confirmation sharing", () => {
  it("builds a contextual message with the customer's first name", () => {
    expect(
      buildCustomerConfirmationShareMessage({
        customerName: "David Okafor",
        businessName: "Bella Cakes",
        confirmationUrl,
      }),
    ).toBe(
      `Hi David, Bella Cakes has sent you your order details for confirmation. Please review the details and confirm that everything is correct using the secure link below.\n\n${confirmationUrl}`,
    );
  });

  it("falls back gracefully when the customer name is unavailable", () => {
    expect(
      buildCustomerConfirmationMessageText({
        customerName: null,
        businessName: "Bella Cakes",
      }),
    ).toMatch(/^Hi, Bella Cakes has sent you/);
  });

  it("includes only the approved contextual inputs and confirmation URL", () => {
    const input = {
      customerName: "David Okafor",
      businessName: "Bella Cakes",
      confirmationUrl,
      address: "Private address",
      phone: "+353000000",
      price: "EUR 500",
      privateNotes: "Do not expose",
    };
    const message = buildCustomerConfirmationShareMessage(input);

    expect(message).toContain(confirmationUrl);
    expect(message).not.toContain(input.address);
    expect(message).not.toContain(input.phone);
    expect(message).not.toContain(input.price);
    expect(message).not.toContain(input.privateNotes);
  });

  it("encodes WhatsApp and Telegram share intents without query injection", () => {
    const message = "Hi David, review this order & confirm?";
    const whatsapp = new URL(buildWhatsAppShareUrl(message, confirmationUrl));
    const telegram = new URL(buildTelegramShareUrl(message, confirmationUrl));

    expect(whatsapp.origin).toBe("https://wa.me");
    expect(whatsapp.searchParams.get("text")).toBe(`${message}\n\n${confirmationUrl}`);
    expect(telegram.origin).toBe("https://t.me");
    expect(telegram.searchParams.get("url")).toBe(confirmationUrl);
    expect(telegram.searchParams.get("text")).toBe(message);
  });

  it("builds generic safe metadata with complete social fields and no PII", () => {
    const metadata = buildPublicConfirmationMetadata({
      token: "safe-token_123",
      businessName: "Bella Cakes",
      businessLogoPath: null,
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toBe("Review your order with Bella Cakes");
    expect(metadata.description).toBe(
      "Bella Cakes has sent you an order for review and confirmation.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Review your order with Bella Cakes",
      description: "Bella Cakes has sent you an order for review and confirmation.",
      siteName: "My Kustomers",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.openGraph).toMatchObject({
      images: [
        expect.objectContaining({
          url: expect.stringContaining(
            "/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
          ),
        }),
      ],
    });
    expect(serialized).not.toContain("David Okafor");
    expect(serialized).not.toContain("Private address");
    expect(serialized).not.toContain("EUR 500");
  });

  it("recognizes messaging preview crawlers without classifying normal browsers", () => {
    expect(isSocialPreviewCrawler("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isSocialPreviewCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isSocialPreviewCrawler("WhatsApp/2.24")).toBe(true);
    expect(
      isSocialPreviewCrawler(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari",
      ),
    ).toBe(false);
  });
});
