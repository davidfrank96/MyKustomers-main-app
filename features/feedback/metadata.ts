import {
  capabilityBrandMetadata,
  type CapabilityBrandInput,
} from "@/features/businesses/social-metadata";

export type FeedbackMetadata = ReturnType<typeof capabilityBrandMetadata>;

export function buildFeedbackMetadata(
  input: CapabilityBrandInput = {},
): FeedbackMetadata {
  return capabilityBrandMetadata("feedback", input);
}
