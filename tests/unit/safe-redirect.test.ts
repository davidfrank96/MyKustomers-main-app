import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/security/redirects";

describe("getSafeRedirectPath", () => {
  it("allows local absolute paths", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("blocks external URLs", () => {
    expect(getSafeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example")).toBe("/dashboard");
  });

  it("blocks malformed values", () => {
    expect(getSafeRedirectPath("dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/dashboard\\evil")).toBe("/dashboard");
  });
});
