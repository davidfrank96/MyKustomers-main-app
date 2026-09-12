import { renderBusinessEmailLogo } from "@/features/businesses/email-logo-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  return renderBusinessEmailLogo((await params).businessId);
}
