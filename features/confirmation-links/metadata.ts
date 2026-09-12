import {
  buildBusinessCapabilityMetadata,
  type CapabilityBrandInput,
} from "@/features/businesses/social-metadata";

export function buildPublicConfirmationMetadata(input: CapabilityBrandInput = {}) {
  return buildBusinessCapabilityMetadata("confirmation", input);
}
