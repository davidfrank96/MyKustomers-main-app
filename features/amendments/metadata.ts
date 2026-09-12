import {
  buildBusinessCapabilityMetadata,
  type CapabilityBrandInput,
} from "@/features/businesses/social-metadata";

export function buildPublicAmendmentMetadata(input: CapabilityBrandInput = {}) {
  return buildBusinessCapabilityMetadata("amendment", input);
}
