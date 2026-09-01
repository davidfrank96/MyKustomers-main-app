import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fbfaf7",
          color: "#18332d",
          padding: "88px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "780px" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
            My Kustomers
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "42px",
              fontSize: 64,
              lineHeight: 1.08,
              fontWeight: 700,
            }}
          >
            Secure order review and confirmation
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "30px",
              fontSize: 28,
              color: "#52655f",
            }}
          >
            Review the details sent by your business before confirming.
          </div>
        </div>
        <div
          style={{
            width: "190px",
            height: "190px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "24px",
            background: "#1f5a4d",
            color: "#ffffff",
            fontSize: 76,
            fontWeight: 700,
          }}
        >
          MK
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
