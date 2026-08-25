import fs from "node:fs";
import { describe, expect, it } from "vitest";

const actions = fs.readFileSync("features/businesses/actions.ts", "utf8");
const onboardingForm = fs.readFileSync(
  "components/forms/business-onboarding-form.tsx",
  "utf8",
);
const logoForm = fs.readFileSync("components/forms/business-logo-form.tsx", "utf8");
const authActions = fs.readFileSync("features/auth/actions.ts", "utf8");
const authServer = fs.readFileSync("lib/auth/server.ts", "utf8");

describe("new-business logo policy", () => {
  it("blocks business creation without a selected required logo", () => {
    expect(onboardingForm).toContain('name="logoSelected"');
    expect(onboardingForm).toContain(
      "Choose a business logo before creating your business.",
    );
    expect(actions).toContain('formValue(formData, "logoSelected") !== "true"');
  });

  it("finishes setup only after the persisted business logo reference exists", () => {
    expect(actions).toContain('.select("logo_path, onboarding_completed_at")');
    expect(actions).toContain("!business?.logo_path");
    expect(actions).toContain(
      "!isBusinessOnboardingPending(business.onboarding_completed_at)",
    );
    expect(actions).toContain('requireBusinessRole(businessId, ["owner"], user)');
    expect(actions).toContain("setSelectedBusinessId(businessId)");
    expect(actions).toContain("clearPendingBusinessOnboardingId()");
    expect(actions).toContain("PENDING_BUSINESS_ONBOARDING_TIMESTAMP");
    expect(authServer).toContain("pendingBusinesses");
  });

  it("keeps image binary on the established owner-authorized upload route", () => {
    expect(logoForm).toContain("/api/businesses/${businessId}/logo");
    expect(logoForm).toContain('body.set("logo", file)');
    expect(onboardingForm).not.toContain('name="logo"');
  });

  it("clears pending setup state on logout", () => {
    expect(authActions).toContain("clearPendingBusinessOnboardingId()");
  });
});
