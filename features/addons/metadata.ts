import type { Metadata } from "next";
import { buildPublicCapabilityMetadata } from "@/features/confirmation-links/metadata";

export function buildPublicAddonMetadata({
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
    routePrefix: "/x",
    title: (safeName) => `Review an addition to your booking with ${safeName}`,
    description: (safeName) =>
      `${safeName} has sent you an addition for review and confirmation.`,
    imageAlt: "My Kustomers secure booking addition",
  });
}
