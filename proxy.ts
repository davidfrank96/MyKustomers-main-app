import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { INTERNAL_REQUEST_PATH_HEADER } from "@/lib/security/redirects";

export async function proxy(request: NextRequest) {
  // Overwrite any client-supplied value before forwarding to the server layout.
  request.headers.set(
    INTERNAL_REQUEST_PATH_HEADER,
    request.nextUrl.pathname + request.nextUrl.search,
  );
  const response = await updateSession(request);

  if (process.env.VERCEL_ENV !== "production") {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet, noimageindex",
    );
  }

  if (/^\/(?:a|c|f|x)\//.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet, noimageindex",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/webhooks/|_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
