import type { Metadata } from "next";
import { buildPublicCapabilityMetadata } from "@/features/confirmation-links/metadata";

export function buildPublicAmendmentMetadata({
  token,
  businessName,
  businessLogoPath,
}: {
  token: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
}): Metadata {
  return buildPublicCapabilityMetadata({
    token,
    businessName,
    businessLogoPath,
    routePrefix: "/a",
    title: (safeName) => `Review an update to your booking with ${safeName}`,
    description: (safeName) =>
      `${safeName} has proposed changes for your review and confirmation.`,
    imageAlt: "My Kustomers secure booking update",
  });
}
