import { getPublicAmendmentImageMetadata } from "@/features/amendments/social";
import { renderBusinessSocialImage } from "@/features/businesses/social-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ previewId: string }> },
) {
  return renderBusinessSocialImage(
    await getPublicAmendmentImageMetadata((await params).previewId),
    "amendment",
  );
}
