import { z } from "zod";
import type { AuthenticatorAssuranceLevel } from "@/lib/auth/server";

const assuranceLevelSchema = z.enum(["aal1", "aal2"]);

const factorSchema = z
  .object({
    id: z.string().uuid(),
    factor_type: z.string().min(1).max(40),
    status: z.enum(["verified", "unverified"]),
    friendly_name: z.string().max(100).optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type AdminMfaFactor = {
  id: string;
  friendlyName: string;
  createdAt: string | null;
};

export type AdminMfaSecurityStatus = {
  currentLevel: AuthenticatorAssuranceLevel;
  nextLevel: AuthenticatorAssuranceLevel;
  verifiedFactors: AdminMfaFactor[];
  unverifiedFactorCount: number;
  privilegedAccessReady: boolean;
};

export function parseAdminMfaSecurityStatus({
  currentLevel,
  nextLevel,
  factors,
  privilegedAccessReady,
}: {
  currentLevel: unknown;
  nextLevel: unknown;
  factors: unknown;
  privilegedAccessReady: unknown;
}): AdminMfaSecurityStatus | null {
  const parsedCurrentLevel = assuranceLevelSchema.safeParse(currentLevel);
  const parsedNextLevel = assuranceLevelSchema.safeParse(nextLevel);
  const parsedFactors = z.array(factorSchema).safeParse(factors);
  const parsedPrivilegedAccessReady = z.boolean().safeParse(privilegedAccessReady);

  if (
    !parsedCurrentLevel.success ||
    !parsedNextLevel.success ||
    !parsedFactors.success ||
    !parsedPrivilegedAccessReady.success
  ) {
    return null;
  }

  return {
    currentLevel: parsedCurrentLevel.data,
    nextLevel: parsedNextLevel.data,
    verifiedFactors: parsedFactors.data
      .filter((factor) => factor.factor_type === "totp" && factor.status === "verified")
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name?.trim() || "Authenticator app",
        createdAt: factor.created_at ?? null,
      })),
    unverifiedFactorCount: parsedFactors.data.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    ).length,
    privilegedAccessReady: parsedPrivilegedAccessReady.data,
  };
}
