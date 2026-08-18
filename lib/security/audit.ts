import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import type { AuditEventType, Json } from "@/types/database";

type AuditEventInput = {
  actorUserId?: string | null;
  businessId?: string | null;
  eventType: AuditEventType;
  metadata?: Json;
};

export type AuditEventResult =
  | { status: "recorded" }
  | { status: "skipped"; reason: "service-role-unavailable" }
  | { status: "failed"; message: string };

export async function recordAuditEvent({
  actorUserId = null,
  businessId = null,
  eventType,
  metadata = {},
}: AuditEventInput): Promise<AuditEventResult> {
  if (!canUseServiceRoleClient()) {
    return { status: "skipped", reason: "service-role-unavailable" };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    business_id: businessId,
    event_type: eventType,
    metadata,
  });

  if (error) {
    return { status: "failed", message: "Audit event could not be recorded." };
  }

  return { status: "recorded" };
}
