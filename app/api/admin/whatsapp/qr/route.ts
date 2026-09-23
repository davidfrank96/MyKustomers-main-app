import { requirePrivilegedPlatformAdmin } from "@/lib/admin/server";
import { getWhatsAppControl } from "@/lib/whatsapp/control";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  };
  try {
    await requirePrivilegedPlatformAdmin(["SUPER_ADMIN"]);
  } catch {
    return Response.json(
      { error: "Additional verification required" },
      { status: 403, headers },
    );
  }
  const qr = await getWhatsAppControl()?.qr();
  return Response.json(
    qr ?? {
      error: "Pairing code unavailable. It may have expired or the account is connected.",
    },
    { status: qr ? 200 : 409, headers },
  );
}
