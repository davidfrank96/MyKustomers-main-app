import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { absoluteSeoUrl } from "@/lib/seo/site";

export type FeedbackMetadata = {
  title: string;
  description: string;
  imageUrl: string;
};

type LegacyFeedbackMetadataInput = {
  token?: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
};

export function buildFeedbackMetadata(
  _legacyInput?: LegacyFeedbackMetadataInput,
): FeedbackMetadata {
  void _legacyInput;
  return {
    title: "Private customer feedback | My Kustomers",
    description: "Open this private link to share feedback about a completed booking.",
    imageUrl: absoluteSeoUrl(MYKUSTOMERS_BRAND_ASSETS.openGraph),
  };
}
