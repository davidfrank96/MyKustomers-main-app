import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { publicEnv } from "@/lib/config/public-env";

export type FeedbackMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
};

function cleanBusinessName(value: string | null | undefined) {
  return (
    value
      ?.replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "your business"
  );
}

export function buildFeedbackMetadata({
  token,
  businessName,
  businessLogoPath,
}: {
  token: string;
  businessName?: string | null;
  businessLogoPath?: string | null;
}): FeedbackMetadata {
  const name = cleanBusinessName(businessName);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return {
    title: `Share private feedback with ${name}`,
    description: `${name} has requested private feedback about your experience.`,
    canonicalUrl: `${baseUrl}/f/${encodeURIComponent(token)}`,
    imageUrl:
      getBusinessLogoPublicUrl(businessLogoPath) ?? `${baseUrl}/confirmation-preview.png`,
  };
}
