import { describe, expect, it } from "vitest";
import { resolveCurrentBusinessId } from "@/lib/auth/current-business-selection";

const businesses = [{ id: "business-a" }, { id: "business-b" }];

describe("current business selection", () => {
  it("sends users without active businesses to onboarding", () => {
    expect(resolveCurrentBusinessId([], null)).toBeNull();
  });

  it("selects the only active business automatically", () => {
    expect(resolveCurrentBusinessId([{ id: "business-a" }], null)).toBe("business-a");
  });

  it("restores a valid selected business", () => {
    expect(resolveCurrentBusinessId(businesses, "business-b")).toBe("business-b");
  });

  it("falls back deterministically when the selection is missing or stale", () => {
    expect(resolveCurrentBusinessId(businesses, null)).toBe("business-a");
    expect(resolveCurrentBusinessId(businesses, "revoked-business")).toBe("business-a");
  });
});
