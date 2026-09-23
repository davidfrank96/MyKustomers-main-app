import "server-only";
import { requirePlatformAdminRole } from "@/lib/admin/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppControl } from "@/lib/whatsapp/control";
import { operationsSchema, type GatewayResult } from "./control-model";
export async function getWhatsAppOperations() {
  await requirePlatformAdminRole(["SUPER_ADMIN"]);
  const db = await createClient();
  const control = getWhatsAppControl();
  const [result, gateway] = await Promise.all([
    db.rpc("get_whatsapp_operations"),
    control?.status() ??
      Promise.resolve<GatewayResult>({
        status: null,
        error: "Gateway control not configured",
      }),
  ]);
  const parsed = operationsSchema.safeParse(result.data);
  return { operations: result.error || !parsed.success ? null : parsed.data, gateway };
}
