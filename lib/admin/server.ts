import "server-only";
import { cache } from "react";
import {
  getAuthenticatedUser,
  requireUser,
  type AuthenticatedUser,
} from "@/lib/auth/server";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import {
  hasPlatformAdminRole,
  parsePlatformAdminAccess,
  type PlatformAdminAccess,
} from "@/lib/admin/access-policy";
import { createClient } from "@/lib/supabase/server";
import type { PlatformAdminRole } from "@/types/database";

export class PlatformAdminAuthorizationError extends Error {
  constructor() {
    super("You are not authorized to access platform administration.");
    this.name = "PlatformAdminAuthorizationError";
  }
}

export const getPlatformAdmin = cache(async function getPlatformAdmin(
  authenticatedUser?: AuthenticatedUser,
): Promise<PlatformAdminAccess | null> {
  const user = authenticatedUser ?? (await getAuthenticatedUser());

  if (!user || !isSupabasePublicEnvConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_platform_admin");

  if (error || !data || data.length !== 1) {
    return null;
  }

  const access = parsePlatformAdminAccess(data[0]);
  return access?.userId === user.id ? access : null;
});

export async function requirePlatformAdmin(
  authenticatedUser?: AuthenticatedUser,
): Promise<PlatformAdminAccess> {
  const user = authenticatedUser ?? (await requireUser("/admin"));
  const access = await getPlatformAdmin(user);

  if (!access) {
    throw new PlatformAdminAuthorizationError();
  }

  return access;
}

export async function requirePlatformAdminRole(
  allowedRoles: readonly PlatformAdminRole[],
  authenticatedUser?: AuthenticatedUser,
): Promise<PlatformAdminAccess> {
  const access = await requirePlatformAdmin(authenticatedUser);

  if (!hasPlatformAdminRole(access, allowedRoles)) {
    throw new PlatformAdminAuthorizationError();
  }

  return access;
}
