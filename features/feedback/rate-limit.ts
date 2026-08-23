import "server-only";
import { consumePublicCapabilityRateLimit } from "@/features/confirmation-links/rate-limit";

type FeedbackRateLimitAction = "feedback_lookup" | "feedback_submit";

const rateLimitConfig: Record<
  FeedbackRateLimitAction,
  { maxRequests: number; windowSeconds: number; blockSeconds: number }
> = {
  feedback_lookup: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
  feedback_submit: { maxRequests: 10, windowSeconds: 60, blockSeconds: 120 },
};

export function consumeFeedbackRateLimit(action: FeedbackRateLimitAction) {
  return consumePublicCapabilityRateLimit(action, rateLimitConfig[action]);
}
