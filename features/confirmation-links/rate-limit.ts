import "server-only";
import {
  consumeRateLimitLayers,
  getTrustedRequestSource,
  type RateLimitLayer,
} from "@/lib/security/rate-limit";

type ConfirmationRateLimitAction = "lookup" | "metadata" | "confirm" | "open";

export type PublicCapabilityRateLimit = {
  maxRequests: number;
  windowSeconds: number;
  blockSeconds: number;
};

const rateLimitConfig: Record<
  ConfirmationRateLimitAction,
  { maxRequests: number; windowSeconds: number; blockSeconds: number }
> = {
  lookup: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
  metadata: { maxRequests: 120, windowSeconds: 60, blockSeconds: 60 },
  confirm: { maxRequests: 10, windowSeconds: 60, blockSeconds: 120 },
  open: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
};

export async function consumePublicCapabilityRateLimit(
  action: string,
  config: PublicCapabilityRateLimit,
  capabilityHash?: string,
) {
  const source = await getTrustedRequestSource();
  const layers: RateLimitLayer[] = [
    {
      action: `${action}_source`,
      keyParts: ["source", source],
      policy: config,
    },
  ];

  if (capabilityHash) {
    layers.push({
      action: `${action}_capability`,
      keyParts: ["capability", capabilityHash],
      policy: config,
    });
  }

  const result = await consumeRateLimitLayers(layers);
  return result.status === "allowed";
}

export function consumeConfirmationRateLimit(
  action: ConfirmationRateLimitAction,
  capabilityHash?: string,
) {
  return consumePublicCapabilityRateLimit(
    action,
    rateLimitConfig[action],
    capabilityHash,
  );
}
