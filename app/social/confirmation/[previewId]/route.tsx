import { renderConfirmationSocialImage } from "@/features/confirmation-links/social-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ previewId: string }> },
) {
  const { previewId } = await params;
  return renderConfirmationSocialImage(previewId);
}
