import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEO_SITE, buildHomepageStructuredData } from "@/lib/seo/site";

const excludedCopy = /\b(?:small[- ](?:Nigerian )?business(?:es)?|Nigerian small businesses|SMEs?|micro businesses)\b/i;
const copyFiles = ["app", "components", "features", "lib", "public"].flatMap((root) =>
  fs.readdirSync(root, { recursive: true }).map(String)
    .filter((file) => /\.(?:tsx?|json|webmanifest)$/.test(file))
    .map((file) => path.join(root, file)),
);

describe("service-business positioning", () => {
  it("has no restrictive master positioning in shipped product sources", () => {
    for (const file of copyFiles) {
      expect(fs.readFileSync(file, "utf8"), file).not.toMatch(excludedCopy);
    }
  });
  it("aligns visible audience copy, SEO, manifest and structured data", () => {
    const home = fs.readFileSync("app/page.tsx", "utf8");
    expect(home).toContain("Built for service businesses — from independent operators to growing teams.");
    expect(home).toContain("Built for service businesses in Nigeria and beyond.");
    expect(SEO_SITE.title).toBe("My Kustomers — Booking & Customer Management for Service Businesses");
    expect(JSON.stringify(buildHomepageStructuredData())).toContain(SEO_SITE.description);
    const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
    expect(manifest.name).toBe("My Kustomers");
    expect(manifest.description).toContain("service businesses");
    expect(home + JSON.stringify(SEO_SITE) + manifest.description).not.toMatch(/enterprise[- ]ready|for enterprise/i);
  });
});
