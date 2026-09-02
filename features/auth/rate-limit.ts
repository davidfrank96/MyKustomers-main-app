import "server-only";

import {
  clearApplicationRateLimit,
  consumeRateLimitLayers,
  getTrustedRequestSource,
  type RateLimitLayer,
} from "@/lib/security/rate-limit";

export type AuthRateLimitFlow = "login" | "signup" | "recovery" | "resend";

const identityPolicies = {
  login: { maxRequests: 8, windowSeconds: 900, blockSeconds: 300 },
  signup: { maxRequests: 3, windowSeconds: 3_600, blockSeconds: 3_600 },
  recovery: { maxRequests: 3, windowSeconds: 3_600, blockSeconds: 3_600 },
  resend: { maxRequests: 3, windowSeconds: 3_600, blockSeconds: 3_600 },
} as const;

const sourcePolicies = {
  login: { maxRequests: 20, windowSeconds: 300, blockSeconds: 300 },
  signup: { maxRequests: 6, windowSeconds: 900, blockSeconds: 900 },
  recovery: { maxRequests: 10, windowSeconds: 3_600, blockSeconds: 3_600 },
  resend: { maxRequests: 10, windowSeconds: 3_600, blockSeconds: 3_600 },
} as const;

export async function consumeAuthRateLimit(flow: AuthRateLimitFlow, email: string) {
  const source = await getTrustedRequestSource();
  const layers: RateLimitLayer[] = [
    {
      action: `auth_${flow}_identity`,
      keyParts: ["email", email],
      policy: identityPolicies[flow],
    },
    {
      action: `auth_${flow}_source`,
      keyParts: ["source", source],
      policy: sourcePolicies[flow],
    },
  ];

  if (flow === "resend") {
    layers.unshift({
      action: "auth_resend_cooldown",
      keyParts: ["email", email],
      policy: { maxRequests: 1, windowSeconds: 60, blockSeconds: 60 },
    });
  }

  return consumeRateLimitLayers(layers);
}

export function clearSuccessfulLoginRateLimit(email: string) {
  return clearApplicationRateLimit({
    action: "auth_login_identity",
    keyParts: ["email", email],
  });
}
