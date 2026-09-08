import type { Metadata } from "next";
import { buildPublicCapabilityMetadata } from "@/features/confirmation-links/metadata";

type LegacyAmendmentMetadataInput = {
  token?: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
};

export function buildPublicAmendmentMetadata(
  _legacyInput?: LegacyAmendmentMetadataInput,
): Metadata {
  void _legacyInput;
  return buildPublicCapabilityMetadata({
    title: "Secure booking update | My Kustomers",
    description: "Open this private link to review a proposed booking update.",
    imageAlt: "My Kustomers secure booking update",
  });
}
