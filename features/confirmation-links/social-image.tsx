import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getPublicConfirmationImageMetadata } from "@/features/confirmation-links/public";

export const confirmationImageHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

const maxLogoBytes = 200 * 1024;

async function readLogo(logoPath: string | null) {
  const url = getBusinessLogoPublicUrl(logoPath);
  if (!url) return null;
  try {
    // The URL comes only from the current business's exact, bounded Storage path.
    // Do not follow redirects or forward request credentials to image storage.
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get("content-length")) > maxLogoBytes
    )
      return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxLogoBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const png = await sharp(Buffer.concat(chunks), { limitInputPixels: 512 * 512 })
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // A missing, invalid or unavailable logo retains the business's identity.
    return null;
  }
}

export async function renderConfirmationSocialImage(previewId: string) {
  const business = await getPublicConfirmationImageMetadata(previewId);
  if (!business) {
    return new Response(null, { status: 404, headers: confirmationImageHeaders });
  }
  const name = business.businessName.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase() || "B";
  const logo = await readLogo(business.businessLogoPath);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f4",
        color: "#17211d",
        padding: "44px 80px",
      }}
    >
      <div
        style={{
          width: 224,
          height: 224,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 24,
          background: "#ffffff",
          border: "1px solid #dde2dd",
          padding: 16,
        }}
      >
        {logo ? (
          // ImageResponse needs an embedded raster, not a next/image element.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={192}
            height={192}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 76, color: "#175c4d" }}>
            {initials}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "center",
          textAlign: "center",
          marginTop: 28,
          fontSize: name.length > 80 ? 36 : 48,
          fontWeight: 700,
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", marginTop: 20, fontSize: 28, color: "#66716c" }}>
        Booking confirmation
      </div>
    </div>,
    { width: 1200, height: 630, headers: confirmationImageHeaders },
  );
}
