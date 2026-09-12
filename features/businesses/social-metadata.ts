import type { Metadata } from "next";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { PRIVATE_ROBOTS, SEO_SITE, absoluteSeoUrl } from "@/lib/seo/site";
import { BRAND_PREVIEW_ID, cleanBusinessBrandName } from "./brand-projection";

export const capabilityBrandCopy = {
  confirmation: {
    label: "Booking confirmation",
    title: (name: string) => `Confirm your booking with ${name}`,
    description: (name: string) => `Review and confirm your booking with ${name}.`,
    genericTitle: "Secure booking confirmation | My Kustomers",
    genericDescription: "Open this private link to review and confirm a booking request.",
  },
  feedback: {
    label: "Customer feedback",
    title: (name: string) => `Share feedback with ${name}`,
    description: (name: string) => `Tell ${name} about your experience.`,
    genericTitle: "Private customer feedback | My Kustomers",
    genericDescription:
      "Open this private link to share feedback about a completed booking.",
  },
  amendment: {
    label: "Booking update",
    title: (name: string) => `Review a booking update from ${name}`,
    description: (name: string) => `Review a proposed booking update from ${name}.`,
    genericTitle: "Secure booking update | My Kustomers",
    genericDescription: "Open this private link to review a proposed booking update.",
  },
  addon: {
    label: "Booking add-on",
    title: (name: string) => `Review a booking add-on from ${name}`,
    description: (name: string) => `Review a proposed booking add-on from ${name}.`,
    genericTitle: "Secure booking addition | My Kustomers",
    genericDescription: "Open this private link to review an addition to a booking.",
  },
} as const;

export type CapabilityBrandKind = keyof typeof capabilityBrandCopy;
export type CapabilityBrandInput = {
  businessName?: string | null;
  businessLogoPath?: string | null;
  previewId?: string | null;
};

export function capabilityBrandMetadata(
  kind: CapabilityBrandKind,
  input: CapabilityBrandInput = {},
) {
  const name = cleanBusinessBrandName(input.businessName ?? "");
  const vendor = name && input.previewId && BRAND_PREVIEW_ID.test(input.previewId);
  const copy = capabilityBrandCopy[kind];
  return {
    title: vendor ? copy.title(name) : copy.genericTitle,
    description: vendor ? copy.description(name) : copy.genericDescription,
    imageUrl: absoluteSeoUrl(
      vendor ? `/social/${kind}/${input.previewId}` : MYKUSTOMERS_BRAND_ASSETS.openGraph,
    ),
    imageAlt: vendor
      ? `${name} business logo`
      : `My Kustomers ${copy.label.toLowerCase()}`,
  };
}

export function buildBusinessCapabilityMetadata(
  kind: CapabilityBrandKind,
  input: CapabilityBrandInput = {},
): Metadata {
  const { title, description, imageUrl, imageAlt } = capabilityBrandMetadata(kind, input);
  return {
    title: { absolute: title },
    description,
    robots: PRIVATE_ROBOTS,
    openGraph: {
      title,
      description,
      siteName: SEO_SITE.name,
      type: "website",
      images: [
        { url: imageUrl, type: "image/png", width: 1200, height: 630, alt: imageAlt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
  };
}
