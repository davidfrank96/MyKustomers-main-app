import { requirePlatformAdminRole } from "@/lib/admin/server";
import { getWhatsAppControl } from "@/lib/whatsapp/control";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    await requirePlatformAdminRole(["SUPER_ADMIN"]);
  } catch {
    return Response.json({ error: "Not authorized" }, { status: 403, headers });
  }
  const result = await getWhatsAppControl()?.status();
  return Response.json(
    result ?? { status: null, error: "Gateway control not configured" },
    { headers },
  );
}
