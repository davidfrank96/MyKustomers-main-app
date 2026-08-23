import { recordPublicConfirmationOpen } from "@/features/confirmation-links/public";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token =
    body && typeof body === "object" && "token" in body && typeof body.token === "string"
      ? body.token
      : null;

  if (token && token.length <= 512) {
    await recordPublicConfirmationOpen(token);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
