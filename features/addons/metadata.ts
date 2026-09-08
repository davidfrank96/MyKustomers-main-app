import type { Metadata } from "next";
import { buildPublicCapabilityMetadata } from "@/features/confirmation-links/metadata";

type LegacyAddonMetadataInput = {
  token?: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
};

export function buildPublicAddonMetadata(
  _legacyInput?: LegacyAddonMetadataInput,
): Metadata {
  void _legacyInput;
  return buildPublicCapabilityMetadata({
    title: "Secure booking addition | My Kustomers",
    description: "Open this private link to review an addition to a booking.",
    imageAlt: "My Kustomers secure booking addition",
  });
}
