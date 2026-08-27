import { describe, expect, it } from "vitest";
import {
  getPwaFreshnessClass,
  isEligibleOfflineNavigation,
  PWA_RESUME_THRESHOLD_MS,
  shouldReconcileAfterResume,
} from "@/features/pwa/reconciliation";

describe("PWA reconciliation policy", () => {
  it("reconciles only after the bounded meaningful-suspension threshold", () => {
    expect(shouldReconcileAfterResume(PWA_RESUME_THRESHOLD_MS - 1)).toBe(false);
    expect(shouldReconcileAfterResume(PWA_RESUME_THRESHOLD_MS)).toBe(true);
    expect(shouldReconcileAfterResume(15 * 60_000)).toBe(true);
  });

  it("classifies booking detail as high freshness without making the client authoritative", () => {
    expect(getPwaFreshnessClass("/bookings/00000000-0000-4000-8000-000000000001")).toBe(
      "HIGH",
    );
    expect(getPwaFreshnessClass("/bookings")).toBe("NORMAL");
    expect(getPwaFreshnessClass("/customers/00000000-0000-4000-8000-000000000001")).toBe(
      "NORMAL",
    );
    expect(getPwaFreshnessClass("/business")).toBe("LOWER");
  });

  it("accepts only a different same-origin navigation for offline retry", () => {
    expect(
      isEligibleOfflineNavigation(
        "/bookings?filter=active",
        "https://mykustomers.com",
        "https://mykustomers.com/dashboard",
      ),
    ).toBe("/bookings?filter=active");
    expect(
      isEligibleOfflineNavigation(
        "https://attacker.example/bookings",
        "https://mykustomers.com",
        "https://mykustomers.com/dashboard",
      ),
    ).toBeNull();
    expect(
      isEligibleOfflineNavigation(
        "https://mykustomers.com/dashboard",
        "https://mykustomers.com",
        "https://mykustomers.com/dashboard",
      ),
    ).toBeNull();
  });
});
