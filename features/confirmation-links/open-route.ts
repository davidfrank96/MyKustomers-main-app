import "server-only";

export async function handlePublicCapabilityOpen(
  request: Request,
  recordOpen: (token: string) => Promise<void>,
) {
  const body = await request.json().catch(() => null);
  const token =
    body && typeof body === "object" && "token" in body && typeof body.token === "string"
      ? body.token
      : null;

  if (token && token.length <= 512) {
    await recordOpen(token);
  }

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
