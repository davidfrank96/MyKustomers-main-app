import {
  buildBusinessCapabilityMetadata,
  type CapabilityBrandInput,
} from "@/features/businesses/social-metadata";

export function buildPublicAddonMetadata(input: CapabilityBrandInput = {}) {
  return buildBusinessCapabilityMetadata("addon", input);
}
