import { describe, expect, it } from "vitest";
import {
  getBusinessInstagramUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";

describe("public business identity links", () => {
  it("returns only safe website schemes without embedded credentials", () => {
    expect(getSafeBusinessWebsiteUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
    expect(getSafeBusinessWebsiteUrl("http://example.com")).toBe("http://example.com/");
    expect(getSafeBusinessWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeBusinessWebsiteUrl("data:text/html,bad")).toBeNull();
    expect(getSafeBusinessWebsiteUrl("https://user:secret@example.com")).toBeNull();
  });

  it("constructs Instagram links only from normalized handles", () => {
    expect(getBusinessInstagramUrl("divine.cakes")).toBe(
      "https://www.instagram.com/divine.cakes/",
    );
    expect(getBusinessInstagramUrl("https://instagram.com/divine")).toBeNull();
    expect(getBusinessInstagramUrl("bad handle")).toBeNull();
  });
});
