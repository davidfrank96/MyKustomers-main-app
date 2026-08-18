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
