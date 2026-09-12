import type { Metadata } from "next";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { PRIVATE_ROBOTS, SEO_SITE, absoluteSeoUrl } from "@/lib/seo/site";

type ConfirmationMetadataInput = {
  businessName?: string | null;
  businessLogoPath?: string | null;
  previewId?: string | null;
};

type PublicCapabilityMetadataInput = {
  title: string;
  description: string;
  imageAlt: string;
};

export function buildPublicCapabilityMetadata({
  title,
  description,
  imageAlt,
}: PublicCapabilityMetadataInput): Metadata {
  return {
    title: { absolute: title },
    description,
    robots: PRIVATE_ROBOTS,
    openGraph: {
      title,
      description,
      siteName: SEO_SITE.name,
      type: "website",
      images: [{ url: MYKUSTOMERS_BRAND_ASSETS.openGraph, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [MYKUSTOMERS_BRAND_ASSETS.openGraph],
    },
  };
}

export function buildPublicConfirmationMetadata(
  input: ConfirmationMetadataInput = {},
): Metadata {
  const businessName = input.businessName?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

  if (!businessName) {
    return buildPublicCapabilityMetadata({
      title: "Secure booking confirmation | My Kustomers",
      description: "Open this private link to review and confirm a booking request.",
      imageAlt: "My Kustomers secure booking confirmation",
    });
  }

  const title = `Confirm your booking with ${businessName}`;
  const description = `Review and confirm your booking with ${businessName}.`;
  const metadata = buildPublicCapabilityMetadata({
    title,
    description,
    imageAlt: `${businessName} business logo`,
  });

  if (
    !input.previewId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.previewId,
    )
  ) {
    return metadata;
  }

  const imageUrl = absoluteSeoUrl(`/social/confirmation/${input.previewId}`);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [
        {
          url: imageUrl,
          type: "image/png",
          width: 1200,
          height: 630,
          alt: `${businessName} business logo`,
        },
      ],
    },
    twitter: {
      ...metadata.twitter,
      card: "summary_large_image",
      images: [imageUrl],
    },
  };
}
