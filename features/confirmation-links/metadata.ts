import type { Metadata } from "next";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { PRIVATE_ROBOTS, SEO_SITE } from "@/lib/seo/site";

type LegacyCapabilityMetadataInput = {
  token?: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
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
  _legacyInput?: LegacyCapabilityMetadataInput,
): Metadata {
  void _legacyInput;
  return buildPublicCapabilityMetadata({
    title: "Secure booking confirmation | My Kustomers",
    description: "Open this private link to review and confirm a booking request.",
    imageAlt: "My Kustomers secure booking confirmation",
  });
}
