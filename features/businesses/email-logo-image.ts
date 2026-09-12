import "server-only";
import sharp from "sharp";
import { getEventBusinessLogoPath } from "./email-brand";
import { readBusinessLogoPng } from "./logo-projection";

export async function renderBusinessEmailLogo(businessId: string) {
  const headers = {
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
    "X-Content-Type-Options": "nosniff",
  };
  const path = await getEventBusinessLogoPath(businessId);
  const logo = path ? await readBusinessLogoPng(path, 184) : null;
  if (!logo)
    return new Response(null, {
      status: 404,
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  // Square raster includes its own padding: older email clients need no object-fit.
  const png = await sharp(logo)
    .flatten({ background: "#ffffff" })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#ffffff" })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      ...headers,
      "Content-Type": "image/png",
      // Public logo only, no capability state. A bounded hour reflects replacements
      // and deletions while sharing the transform across email-client requests.
      "Cache-Control": "public, max-age=3600, s-maxage=3600, must-revalidate",
    },
  });
}
