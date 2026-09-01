import type { Metadata } from "next";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { publicEnv } from "@/lib/config/public-env";

type PublicCapabilityMetadataInput = {
  token: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
  routePrefix: "/c" | "/a" | "/x";
  title: (businessName: string) => string;
  description: (businessName: string) => string;
  imageAlt: string;
};

export function buildPublicCapabilityMetadata({
  token,
  businessName,
  businessLogoPath,
  routePrefix,
  title: buildTitle,
  description: buildDescription,
  imageAlt,
}: PublicCapabilityMetadataInput): Metadata {
  const safeBusinessName =
    businessName?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || "your business";
  const title = buildTitle(safeBusinessName);
  const description = buildDescription(safeBusinessName);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const canonicalUrl = `${baseUrl}${routePrefix}/${encodeURIComponent(token)}`;
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
      siteName: "My Kustomers",
      type: "website",
      images: [{ url: imageUrl, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildPublicConfirmationMetadata(
  input: Omit<
    PublicCapabilityMetadataInput,
    "routePrefix" | "title" | "description" | "imageAlt"
  >,
): Metadata {
  return buildPublicCapabilityMetadata({
    ...input,
    routePrefix: "/c",
    title: (businessName) => `Review your order with ${businessName}`,
    description: (businessName) =>
      `${businessName} has sent you an order for review and confirmation.`,
    imageAlt: "My Kustomers secure order confirmation",
  });
}
