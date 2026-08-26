import fs from "node:fs";
import { describe, expect, it } from "vitest";

const adminServer = fs.readFileSync("lib/admin/server.ts", "utf8");
const authServer = fs.readFileSync("lib/auth/server.ts", "utf8");
const mfaComponent = fs.readFileSync("components/admin/admin-mfa-security.tsx", "utf8");
const mfaServer = fs.readFileSync("features/admin/security-server.ts", "utf8");
const privilegedDialog = fs.readFileSync(
  "components/admin/privileged-action-dialog.tsx",
  "utf8",
);
const nextConfig = fs.readFileSync("next.config.ts", "utf8");

describe("platform admin MFA boundary", () => {
  it("uses verified Supabase claims and rechecks active platform authority", () => {
    expect(authServer).toContain("supabase.auth.getClaims()");
    expect(authServer).toContain('claims.aal === "aal2"');
    expect(adminServer).toContain("getPlatformAdmin(user)");
    expect(adminServer).toContain("getAuthenticatedAssuranceLevel()");
    expect(adminServer).toContain("evaluatePrivilegedPlatformAdminAccess");
    expect(adminServer).not.toMatch(/formData|mfaVerified|client.*aal/i);
    expect(mfaServer).toContain("getAuthenticatedAssuranceLevel()");
    expect(mfaServer).not.toContain("getAuthenticatorAssuranceLevel()");
  });

  it("uses only native Supabase TOTP enrollment and challenge APIs", () => {
    expect(mfaComponent).toContain("supabase.auth.mfa.enroll");
    expect(mfaComponent).toContain('factorType: "totp"');
    expect(mfaComponent).toContain("supabase.auth.mfa.challengeAndVerify");
    expect(mfaComponent).toContain("supabase.auth.mfa.listFactors");
    expect(mfaComponent).toContain("supabase.auth.mfa.unenroll");
    expect(mfaComponent).not.toMatch(
      /localStorage|sessionStorage|console\.|window\.confirm|window\.prompt/,
    );
  });

  it("keeps secret-bearing screens private and out of shared caches", () => {
    expect(nextConfig).toContain('source: "/admin/security/:path*"');
    expect(nextConfig).toContain('value: "private, no-store, max-age=0"');
    expect(nextConfig).toContain('value: "no-referrer"');
    expect(nextConfig).toContain('value: "noindex, nofollow"');
  });

  it("provides application confirmation without generic action dispatch", () => {
    expect(privilegedDialog).toContain("DialogContent");
    expect(privilegedDialog).toContain("requiresReason");
    expect(privilegedDialog).not.toMatch(
      /window\.confirm|window\.prompt|actionName|dispatchAction/,
    );
  });

  it("does not introduce failed-email retry or another admin mutation", () => {
    expect(mfaComponent).not.toMatch(/retry|suspend|delete business|impersonat/i);
    expect(privilegedDialog).not.toMatch(/retryFailedEmail|suspendBusiness|impersonat/i);
  });
});
