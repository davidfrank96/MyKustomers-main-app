import { getPublicAddonImageMetadata } from "@/features/addons/social";
import { renderBusinessSocialImage } from "@/features/businesses/social-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ previewId: string }> },
) {
  return renderBusinessSocialImage(
    await getPublicAddonImageMetadata((await params).previewId),
    "addon",
  );
}
