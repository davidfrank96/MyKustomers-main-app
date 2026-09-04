import "server-only";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";

// Code-only compatibility projection for legacy rows without attempt history.
// Input must come from the existing authorized admin RPC, never a browser batch.
export async function findDevelopmentAdapterEvents(ids: string[]): Promise<Set<string>> {
  await requirePlatformAdmin();
  const parsed = z.array(z.string().uuid()).max(20).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0 || !canUseServiceRoleClient()) {
    return new Set();
  }
  const { data, error } = await createServiceRoleClient()
    .from("email_events")
    .select("id")
    .in("id", parsed.data)
    .like("provider_message_id", "development-%")
    .limit(20);
  if (error) throw new Error("Email adapter evidence is unavailable.");
  const allowed = new Set(parsed.data);
  return new Set((data ?? []).map((row) => row.id).filter((id) => allowed.has(id)));
}
