import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";

const publicPath = (asset: string) => path.join(process.cwd(), "public", asset);

describe("MyKustomers.com runtime brand assets", () => {
  it("keeps every declared asset in the versioned public directory", () => {
    const declaredAssets = [
      ...Object.values(MYKUSTOMERS_BRAND_ASSETS.logo),
      ...Object.values(MYKUSTOMERS_BRAND_ASSETS.favicon),
      ...Object.values(MYKUSTOMERS_BRAND_ASSETS.pwa),
      MYKUSTOMERS_BRAND_ASSETS.openGraph,
      MYKUSTOMERS_BRAND_ASSETS.email,
    ];

    expect(new Set(declaredAssets).size).toBe(declaredAssets.length);
    for (const asset of declaredAssets) {
      expect(asset).toMatch(/^\/brand\/mykustomers\/v1\//);
      expect(fs.existsSync(publicPath(asset))).toBe(true);
    }
  });

  it("preserves manifest behavior while assigning exact icon purposes", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    ) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
    };

    expect(manifest).toMatchObject({
      name: "My Kustomers",
      short_name: "Kustomers",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#fbfaf7",
      background_color: "#fbfaf7",
    });
    expect(manifest.icons).toEqual([
      {
        src: MYKUSTOMERS_BRAND_ASSETS.pwa.size192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: MYKUSTOMERS_BRAND_ASSETS.pwa.size512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: MYKUSTOMERS_BRAND_ASSETS.pwa.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: MYKUSTOMERS_BRAND_ASSETS.pwa.monochrome192,
        sizes: "192x192",
        type: "image/png",
        purpose: "monochrome",
      },
      {
        src: MYKUSTOMERS_BRAND_ASSETS.pwa.monochrome512,
        sizes: "512x512",
        type: "image/png",
        purpose: "monochrome",
      },
    ]);
  });
});
