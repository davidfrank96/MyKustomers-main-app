import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { cleanBusinessBrandName } from "./brand-projection";

export type SecurePreviewVariant = "confirmation" | "feedback";

// Deliberately cannot accept a customer, booking, capability, token, or URL.
type SecurePreviewIdentity = { businessName: string; logo: Buffer | null };

export const secureSocialImageHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

const copy = {
  confirmation: {
    label: "Booking confirmation",
    heading: "Review your booking",
    description: (name: string) =>
      `${name} has sent you booking details for confirmation.`,
    genericDescription: "Review and confirm your booking securely with the business.",
    trust: "Secure confirmation",
  },
  feedback: {
    label: "Private feedback",
    heading: "Share your feedback",
    description: (name: string) =>
      `${name} would appreciate your private feedback about your experience.`,
    genericDescription: "Share your feedback securely and privately with the business.",
    trust: "Private feedback request",
  },
} as const;

async function brandPng(path: string) {
  return `data:image/png;base64,${(await readFile(join(process.cwd(), "public", path))).toString("base64")}`;
}

function PreviewIllustration({ variant }: { variant: SecurePreviewVariant }) {
  return (
    <svg width="300" height="300" viewBox="0 0 300 300" fill="none">
      <path
        d="M37 87C69 19 160 11 231 59s82 127 24 190S89 304 42 245 6 155 37 87Z"
        fill="#edf8f3"
      />
      <path
        d="M70 86C120 45 192 47 231 107s34 110-13 144-121 12-154-40S19 128 70 86Z"
        fill="#ddf2e9"
      />
      {variant === "confirmation" ? (
        <g transform="rotate(-7 145 154)">
          <rect
            x="64"
            y="83"
            width="151"
            height="155"
            rx="19"
            fill="white"
            stroke="#18765e"
            strokeWidth="8"
          />
          <path d="M69 124H211" stroke="#c2e7d9" strokeWidth="8" />
          <rect
            x="91"
            y="63"
            width="15"
            height="40"
            rx="7.5"
            fill="#ddf2e9"
            stroke="#18765e"
            strokeWidth="7"
          />
          <rect
            x="175"
            y="63"
            width="15"
            height="40"
            rx="7.5"
            fill="#ddf2e9"
            stroke="#18765e"
            strokeWidth="7"
          />
          <path
            d="M94 153H132M94 179H119M94 205H143"
            stroke="#18765e"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="213" cy="198" r="59" fill="#c6e7da" />
          <circle
            cx="208"
            cy="191"
            r="55"
            fill="#116e53"
            stroke="white"
            strokeWidth="9"
          />
          <path
            d="m184 190 18 18 31-39"
            stroke="white"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g transform="rotate(-7 145 154)">
          <path
            d="M84 81H207a23 23 0 0 1 23 23v98a23 23 0 0 1-23 23H123l-53 29 12-38a23 23 0 0 1-20-23v-89a23 23 0 0 1 22-23Z"
            fill="white"
            stroke="#18765e"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <path
            d="M96 123H180M96 151H144M96 179H123"
            stroke="#18765e"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="213" cy="198" r="59" fill="#c6e7da" />
          <circle
            cx="208"
            cy="191"
            r="55"
            fill="#116e53"
            stroke="white"
            strokeWidth="9"
          />
          <path
            d="m208 160 9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3Z"
            fill="white"
            stroke="white"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      )}
      <path
        d="m250 50 3-18m13 30 14-14m-7 29 18-5"
        stroke="#288e71"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export async function renderSecureSocialImage(
  variant: SecurePreviewVariant,
  identity: SecurePreviewIdentity | null = null,
) {
  const text = copy[variant];
  const name = cleanBusinessBrandName(identity?.businessName ?? "") || "MyKustomers.com";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
  // Keep the full business name in metadata/the identity block. Bound its repeat
  // in the supporting sentence so very long names cannot crowd the illustration.
  const nameCharacters = Array.from(name);
  const shortName =
    nameCharacters.length > 55 ? `${nameCharacters.slice(0, 52).join("").trim()}…` : name;
  try {
    const [platformLogo, genericIcon, regularFont, boldFont] = await Promise.all([
      brandPng(MYKUSTOMERS_BRAND_ASSETS.logo.horizontal),
      identity ? Promise.resolve(null) : brandPng(MYKUSTOMERS_BRAND_ASSETS.logo.icon),
      readFile(join(process.cwd(), "public/fonts/inter/Inter-Regular.ttf")),
      readFile(join(process.cwd(), "public/fonts/inter/Inter-Bold.ttf")),
    ]);
    const vendorLogo = identity?.logo
      ? `data:image/png;base64,${identity.logo.toString("base64")}`
      : genericIcon;
    const response = new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#fbfcfb",
          border: "4px solid #124f40",
          borderRadius: 36,
          overflow: "hidden",
          color: "#071b22",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 44,
            top: 36,
            width: 180,
            height: 180,
            borderRadius: 22,
            background: "#edf5f1",
            border: "1px solid #dce8e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {vendorLogo ? (
            // ImageResponse embeds the bounded raster; no authenticated browser fetch.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendorLogo}
              alt=""
              width={168}
              height={168}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: 68, color: "#175c4d", fontWeight: 700 }}>
              {initials}
            </span>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 266,
            top: 49,
            width: 840,
            height: 169,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "block",
              fontSize: name.length > 65 ? 34 : name.length > 35 ? 40 : 48,
              fontWeight: 700,
              lineHeight: 1.13,
              letterSpacing: -1.4,
              wordBreak: "break-word",
              lineClamp: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#8a9599", marginTop: 12 }}>
            {text.label}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 44,
            top: 266,
            display: "flex",
            flexDirection: "column",
            width: 790,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 58,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: -1.8,
            }}
          >
            {text.heading}
          </div>
          <div
            style={{
              display: "block",
              width: 760,
              marginTop: 18,
              fontSize: shortName.length > 35 ? 30 : 34,
              lineHeight: 1.32,
              color: "#606b70",
              lineClamp: 3,
              wordBreak: "break-word",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity ? text.description(shortName) : text.genericDescription}
          </div>
        </div>
        <div style={{ display: "flex", position: "absolute", right: 30, top: 187 }}>
          <PreviewIllustration variant={variant} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 492,
            height: 130,
            display: "flex",
            alignItems: "center",
            borderTop: "2px solid #e5ebe7",
            padding: "0 44px",
          }}
        >
          <svg width="44" height="48" viewBox="0 0 44 48" fill="none">
            <path d="M12 20v-7a10 10 0 0 1 20 0v7" stroke="#125b48" strokeWidth="5" />
            <rect x="5" y="19" width="34" height="28" rx="5" fill="#125b48" />
            <circle cx="22" cy="30" r="3" fill="white" />
            <path d="M22 32v6" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 23 }}>
            <div
              style={{ display: "flex", fontSize: 31, color: "#125b48", fontWeight: 700 }}
            >
              {text.trust}
            </div>
            <div
              style={{ display: "flex", fontSize: 26, color: "#747e83", marginTop: 5 }}
            >
              Powered by MyKustomers.com
            </div>
          </div>
          {/* Official, unmodified platform artwork stays secondary to the vendor. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={platformLogo}
            alt=""
            width={276}
            height={91}
            style={{ position: "absolute", right: 37, objectFit: "contain" }}
          />
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        headers: secureSocialImageHeaders,
        fonts: [
          { name: "Inter", data: regularFont, weight: 400, style: "normal" },
          { name: "Inter", data: boldFont, weight: 700, style: "normal" },
        ],
      },
    );
    // Finish the stream here so rendering errors can use the safe brand fallback.
    return new Response(await response.arrayBuffer(), {
      headers: { ...secureSocialImageHeaders, "Content-Type": "image/png" },
    });
  } catch {
    return new Response(
      await readFile(join(process.cwd(), "public", MYKUSTOMERS_BRAND_ASSETS.openGraph)),
      { headers: { ...secureSocialImageHeaders, "Content-Type": "image/png" } },
    );
  }
}
