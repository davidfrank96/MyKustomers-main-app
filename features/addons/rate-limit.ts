import "server-only";
import { consumePublicCapabilityRateLimit } from "@/features/confirmation-links/rate-limit";

type AddonRateAction = "addon_lookup" | "addon_metadata" | "addon_confirm" | "addon_open";

const limits: Record<
  AddonRateAction,
  { maxRequests: number; windowSeconds: number; blockSeconds: number }
> = {
  addon_lookup: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
  addon_metadata: { maxRequests: 120, windowSeconds: 60, blockSeconds: 60 },
  addon_confirm: { maxRequests: 10, windowSeconds: 60, blockSeconds: 120 },
  addon_open: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
};

export async function consumeAddonRateLimit(action: AddonRateAction) {
  return consumePublicCapabilityRateLimit(action, limits[action]);
}
