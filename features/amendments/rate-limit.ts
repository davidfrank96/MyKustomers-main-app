import "server-only";
import { consumePublicCapabilityRateLimit } from "@/features/confirmation-links/rate-limit";

type AmendmentRateAction =
  "amendment_lookup" | "amendment_metadata" | "amendment_confirm" | "amendment_open";

const limits: Record<
  AmendmentRateAction,
  { maxRequests: number; windowSeconds: number; blockSeconds: number }
> = {
  amendment_lookup: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
  amendment_metadata: { maxRequests: 120, windowSeconds: 60, blockSeconds: 60 },
  amendment_confirm: { maxRequests: 10, windowSeconds: 60, blockSeconds: 120 },
  amendment_open: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
};

export async function consumeAmendmentRateLimit(action: AmendmentRateAction) {
  return consumePublicCapabilityRateLimit(action, limits[action]);
}
