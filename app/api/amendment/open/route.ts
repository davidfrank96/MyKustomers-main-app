import { recordPublicAmendmentOpen } from "@/features/amendments/public";
import { handlePublicCapabilityOpen } from "@/features/confirmation-links/open-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePublicCapabilityOpen(request, recordPublicAmendmentOpen);
}
