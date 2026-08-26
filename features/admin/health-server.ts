import "server-only";
import { cache } from "react";
import {
  parseAdminHealthSummary,
  parseAdminSecurityActivity,
  type AdminHealthSummary,
  type AdminRuntimeConfiguration,
  type AdminSecurityActivity,
} from "@/features/admin/health";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { isSupabasePublicEnvConfigured, publicEnv } from "@/lib/config/public-env";
import { isSupabaseServiceRoleEnvConfigured } from "@/lib/config/server-env";
import {
  getTransactionalEmailProviderSelection,
  getTransactionalEmailProviderSelectionForName,
} from "@/lib/email/provider";
import { createClient } from "@/lib/supabase/server";

export class AdminHealthUnavailableError extends Error {
  constructor(source: "summary" | "activity") {
    super(`Administrator health ${source} is currently unavailable.`);
    this.name = "AdminHealthUnavailableError";
  }
}

export const getAdminHealthSummary = cache(
  async function getAdminHealthSummary(): Promise<AdminHealthSummary> {
    await requirePlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_platform_admin_health_summary");
    const parsed = error ? null : parseAdminHealthSummary(data);

    if (!parsed) throw new AdminHealthUnavailableError("summary");
    return parsed;
  },
);

export const getAdminSecurityActivity = cache(
  async function getAdminSecurityActivity(): Promise<AdminSecurityActivity> {
    await requirePlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_platform_admin_security_activity", {
      p_limit: 12,
    });
    const parsed = error ? null : parseAdminSecurityActivity(data);

    if (!parsed) throw new AdminHealthUnavailableError("activity");
    return parsed;
  },
);

function resolveEnvironment(): AdminRuntimeConfiguration["environment"] {
  switch (process.env.VERCEL_ENV) {
    case "production":
      return "PRODUCTION";
    case "preview":
      return "PREVIEW";
    case "development":
      return "DEVELOPMENT";
    default:
      return process.env.NODE_ENV === "development" ? "LOCAL" : "UNKNOWN";
  }
}

export function getAdminRuntimeConfiguration(): AdminRuntimeConfiguration {
  const environment = resolveEnvironment();
  const canonicalDomain = new URL(publicEnv.NEXT_PUBLIC_APP_URL).hostname;
  const primary = getTransactionalEmailProviderSelection();
  const standby = getTransactionalEmailProviderSelectionForName("resend");
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;

  return {
    environment,
    canonicalDomain,
    canonicalDomainConfigured:
      environment !== "PRODUCTION" || canonicalDomain === "mykustomers.com",
    deploymentCommit: deploymentCommit?.slice(0, 12) ?? null,
    supabasePublicConfigured: isSupabasePublicEnvConfigured(),
    supabaseServiceConfigured: isSupabaseServiceRoleEnvConfigured(),
    primaryEmailProvider: {
      name: primary.name,
      label: primary.label,
      configured: primary.configured,
    },
    standbyEmailProvider: {
      name: "resend",
      label: "Resend",
      configured: standby.configured,
    },
  };
}
