import "server-only";
import { ImageResponse } from "next/og";
import { cleanBusinessBrandName, type BusinessBrandProjection } from "./brand-projection";
import { readBusinessLogoPng } from "./logo-projection";
import { capabilityBrandCopy, type CapabilityBrandKind } from "./social-metadata";

export const businessSocialImageHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

export async function renderBusinessSocialImage(
  business: BusinessBrandProjection | null,
  kind: CapabilityBrandKind,
) {
  if (!business)
    return new Response(null, { status: 404, headers: businessSocialImageHeaders });
  const name = cleanBusinessBrandName(business.businessName);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase() || "B";
  const logo = await readBusinessLogoPng(business.businessLogoPath);
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
        padding: "36px 80px",
      }}
    >
      <div
        style={{
          width: 304,
          height: 304,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid #dde2dd",
        }}
      >
        {logo ? (
          // Embedded raster is required by ImageResponse.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${logo.toString("base64")}`}
            alt=""
            width={280}
            height={280}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 100, color: "#175c4d" }}>
            {initials}
          </div>
        )}
      </div>
      <div
        style={{
          display: "block",
          width: 570,
          justifyContent: "center",
          textAlign: "center",
          marginTop: 24,
          fontSize: name.length > 65 ? 32 : name.length > 30 ? 40 : 46,
          fontWeight: 700,
          lineHeight: 1.14,
          wordBreak: "break-word",
          lineClamp: 3,
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 26, color: "#66716c" }}>
        {capabilityBrandCopy[kind].label}
      </div>
    </div>,
    { width: 1200, height: 630, headers: businessSocialImageHeaders },
  );
}
