import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { buildPublicAmendmentMetadata } from "@/features/amendments/metadata";
import { buildPublicAddonMetadata } from "@/features/addons/metadata";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { buildFeedbackMetadata } from "@/features/feedback/metadata";
import {
  PRIVATE_ROBOTS,
  SEO_SITE,
  buildHomepageStructuredData,
  serializeStructuredData,
} from "@/lib/seo/site";

const originalVercelEnvironment = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalVercelEnvironment === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnvironment;
  }
});

describe("SEO Phase 1 foundation", () => {
  it("uses the exact canonical K-domain and truthful core positioning", () => {
    expect(SEO_SITE.origin).toBe("https://mykustomers.com");
    expect(SEO_SITE.name).toBe("My Kustomers");
    expect(JSON.stringify(SEO_SITE)).not.toMatch(/mycustomers\.com/i);
    expect(SEO_SITE.title).toContain("Booking & Customer Management");
  });

  it("publishes only the homepage in the canonical sitemap", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("https://mykustomers.com/");
    expect(entries[0]).not.toHaveProperty("lastModified");
    expect(JSON.stringify(entries)).not.toMatch(
      /login|signup|dashboard|admin|\/c\/|\/a\/|\/x\/|\/f\//,
    );
  });

  it("allows Production crawling but disallows every non-Production deployment", () => {
    process.env.VERCEL_ENV = "production";
    expect(robots()).toMatchObject({
      host: "https://mykustomers.com",
      sitemap: "https://mykustomers.com/sitemap.xml",
      rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    });

    process.env.VERCEL_ENV = "preview";
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("emits valid, escaped, truthful homepage structured data", () => {
    const serialized = serializeStructuredData(buildHomepageStructuredData());
    const parsed = JSON.parse(serialized) as { "@graph": Array<Record<string, unknown>> };
    expect(parsed["@graph"].map((item) => item["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
    ]);
    expect(serialized).toContain("https://mykustomers.com");
    for (const item of parsed["@graph"]) {
      expect(item).not.toHaveProperty("aggregateRating");
      expect(item).not.toHaveProperty("review");
      expect(item).not.toHaveProperty("offers");
      expect(item).not.toHaveProperty("founder");
      expect(item).not.toHaveProperty("address");
    }
    expect(serializeStructuredData({ unsafe: "</script>" })).not.toContain("</script>");
  });

  it("keeps capability metadata noindex and free of capability URLs", () => {
    const privateInput = {
      businessName: "Private Tenant Ltd",
      businessLogoPath: "private/logo.webp",
    };
    const confirmationMetadata = buildPublicConfirmationMetadata(privateInput);
    const capabilityMetadata = [
      buildPublicAmendmentMetadata(privateInput),
      buildPublicAddonMetadata(privateInput),
    ];
    const metadata = [
      confirmationMetadata,
      ...capabilityMetadata,
      buildFeedbackMetadata(privateInput),
    ];
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toContain("secret-capability-token");
    expect(JSON.stringify(capabilityMetadata)).not.toContain("Private Tenant Ltd");
    expect(JSON.stringify(confirmationMetadata)).not.toContain("Private Tenant Ltd");
    expect(serialized).not.toContain("private/logo.webp");
    expect(serialized).not.toMatch(/\/c\/|\/a\/|\/x\/|\/f\//);
    for (const entry of [confirmationMetadata, ...capabilityMetadata]) {
      expect(entry).toMatchObject({ robots: PRIVATE_ROBOTS });
      expect(entry).not.toHaveProperty("alternates");
      expect(entry.openGraph).not.toHaveProperty("url");
    }
  });
});
