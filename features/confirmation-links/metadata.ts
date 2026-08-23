import type { Metadata } from "next";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { publicEnv } from "@/lib/config/public-env";

type ConfirmationMetadataInput = {
  token: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
};

export function buildPublicConfirmationMetadata({
  token,
  businessName,
  businessLogoPath,
}: ConfirmationMetadataInput): Metadata {
  const safeBusinessName =
    businessName?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || "your business";
  const title = `Review your order with ${safeBusinessName}`;
  const description = `${safeBusinessName} has sent you an order for review and confirmation.`;
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const canonicalUrl = `${baseUrl}/c/${encodeURIComponent(token)}`;
  const businessLogoUrl = getBusinessLogoPublicUrl(businessLogoPath);
  const imageUrl = businessLogoUrl ?? `${baseUrl}/confirmation-preview.png`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "My Customers",
      type: "website",
      images: [{ url: imageUrl, alt: "My Customers secure order confirmation" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
