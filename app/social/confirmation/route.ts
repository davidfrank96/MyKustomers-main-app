import { renderSecureSocialImage } from "@/features/businesses/secure-social-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return renderSecureSocialImage("confirmation");
}
