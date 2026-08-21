import { describe, expect, it } from "vitest";
import {
  businessProfileSchema,
  slugifyBusinessSlug,
} from "@/features/businesses/validation";

describe("business validation", () => {
  it("normalizes URL-safe slugs from business names", () => {
    expect(slugifyBusinessSlug("Divine Cakes")).toBe("divine-cakes");
    expect(slugifyBusinessSlug("  Café & Events!!!  ")).toBe("cafe-events");
  });

  it("accepts a minimal valid business profile", () => {
    const parsed = businessProfileSchema.safeParse({
      name: "Divine Cakes",
      category: "Bakery",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("divine-cakes");
      expect(parsed.data.category).toBe("Bakery");
    }
  });

  it("normalizes optional email and instagram fields", () => {
    const parsed = businessProfileSchema.safeParse({
      name: "Divine Cakes",
      slug: "Divine Cakes Lagos",
      category: "Bakery",
      email: "HELLO@DIVINECAKES.EXAMPLE",
      instagram: "@DivineCakes",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("divine-cakes-lagos");
      expect(parsed.data.email).toBe("hello@divinecakes.example");
      expect(parsed.data.instagram).toBe("divinecakes");
    }
  });

  it("normalizes safe business websites and preserves explicit http", () => {
    const domainOnly = businessProfileSchema.parse({
      name: "Divine Cakes",
      category: "Bakery",
      website: "divinecakes.example/shop#menu",
    });
    const explicitHttp = businessProfileSchema.parse({
      name: "Divine Cakes",
      category: "Bakery",
      website: "http://divinecakes.example",
    });

    expect(domainOnly.website).toBe("https://divinecakes.example/shop");
    expect(explicitHttp.website).toBe("http://divinecakes.example/");
  });

  it("accepts an empty website and rejects unsafe, invalid, or excessive URLs", () => {
    const empty = businessProfileSchema.parse({
      name: "Divine Cakes",
      category: "Bakery",
      website: "  ",
    });
    expect(empty.website).toBeUndefined();

    for (const website of [
      "javascript:alert(1)",
      "data:text/html,bad",
      "file:///tmp/logo",
      "https://user:password@example.com",
      "not a website",
      `https://example.com/${"a".repeat(2048)}`,
    ]) {
      expect(
        businessProfileSchema.safeParse({
          name: "Divine Cakes",
          category: "Bakery",
          website,
        }).success,
        website,
      ).toBe(false);
    }
  });

  it("rejects invalid categories and unsafe contact details", () => {
    const parsed = businessProfileSchema.safeParse({
      name: "Divine Cakes",
      category: "Marketplace",
      phone: "<script>",
      instagram: "https://instagram.com/divinecakes",
    });

    expect(parsed.success).toBe(false);
  });
});
