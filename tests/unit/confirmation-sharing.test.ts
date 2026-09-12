import { describe, expect, it, vi } from "vitest";
import {
  buildCustomerConfirmationMessageText,
  buildCustomerConfirmationShareMessage,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "@/features/confirmation-links/share";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

vi.mock("@/features/businesses/logo-public", () => ({
  getBusinessLogoPublicUrl: (path: string | null | undefined) =>
    path
      ? `https://project.supabase.co/storage/v1/object/public/business-logos/${path}`
      : null,
}));

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

  it("builds vendor-branded noindex confirmation metadata without token data", () => {
    const logoPath = "11111111-1111-4111-8111-111111111111/logo.webp";
    const metadata = buildPublicConfirmationMetadata({
      businessName: "Bella Cakes",
      businessLogoPath: logoPath,
      previewId: "11111111-1111-4111-8111-111111111112",
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toEqual({
      absolute: "Confirm your booking with Bella Cakes",
    });
    expect(metadata.description).toBe(
      "Review and confirm your booking with Bella Cakes.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Confirm your booking with Bella Cakes",
      description: "Review and confirm your booking with Bella Cakes.",
      siteName: "My Kustomers",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.openGraph).toMatchObject({
      images: [
        expect.objectContaining({
          url: "https://mykustomers.com/social/confirmation/11111111-1111-4111-8111-111111111112",
          type: "image/png",
          width: 1200,
          height: 630,
          alt: "Bella Cakes business logo",
        }),
      ],
    });
    expect(serialized).not.toContain("David Okafor");
    expect(serialized).not.toContain("Private address");
    expect(serialized).not.toContain("EUR 500");
    expect(serialized).not.toContain("safe-token_123");
    expect(serialized).toContain("Bella Cakes");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it("uses the neutral platform fallback when business identity is unavailable", () => {
    const metadata = buildPublicConfirmationMetadata();
    expect(metadata.title).toEqual({
      absolute: "Secure booking confirmation | My Kustomers",
    });
    expect(metadata.openGraph).toMatchObject({
      images: [
        expect.objectContaining({
          url: expect.stringContaining(
            "/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
          ),
        }),
      ],
    });
  });

  it("keeps each confirmation preview bound to its own business logo", () => {
    const businessA = buildPublicConfirmationMetadata({
      businessName: "Business A",
      businessLogoPath: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.webp",
      previewId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const businessB = buildPublicConfirmationMetadata({
      businessName: "Business B",
      businessLogoPath: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.webp",
      previewId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const serializedA = JSON.stringify(businessA);
    const serializedB = JSON.stringify(businessB);

    expect(serializedA).toContain("Business A");
    expect(serializedA).toContain("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(serializedA).not.toContain("Business B");
    expect(serializedA).not.toContain("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(serializedB).toContain("Business B");
    expect(serializedB).toContain("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(serializedB).not.toContain("Business A");
    expect(serializedB).not.toContain("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
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
