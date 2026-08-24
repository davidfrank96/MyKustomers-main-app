import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  preparePlaywrightArtifacts,
  redactDiagnosticText,
} from "../../scripts/prepare-playwright-ci-artifacts.mjs";

describe("Playwright CI artifact sanitizer", () => {
  it("redacts secrets, capability URLs, OAuth values, JWTs, and email addresses", () => {
    const secret = "service-role-secret-value";
    const diagnostic = [
      secret,
      "https://app.example/c/abcdefghijklmnopqrstuvwxyz123456",
      "https://app.example/auth/callback?code=oauth-code-value&next=/dashboard",
      "Authorization: Bearer browser-token-value",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      "person@example.com",
    ].join("\n");

    const redacted = redactDiagnosticText(diagnostic, [secret]);

    expect(redacted).not.toContain(secret);
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).not.toContain("oauth-code-value");
    expect(redacted).not.toContain("browser-token-value");
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redacted).not.toContain("person@example.com");
    expect(redacted).toContain("/c/[REDACTED_TOKEN]");
    expect(redacted).toContain("code=[REDACTED]");
  });

  it("copies only sanitized text diagnostics and excludes raw trace data", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-diagnostics-"));
    const inputDir = path.join(root, "test-results");
    const outputDir = path.join(root, "ci-artifacts");
    const resultDir = path.join(inputDir, "failed-test");
    const secret = "configured-secret-value";

    try {
      fs.mkdirSync(resultDir, { recursive: true });
      fs.writeFileSync(
        path.join(inputDir, "results.json"),
        JSON.stringify({ error: `${secret} at /f/abcdefghijklmnopqrstuvwxyz123456` }),
      );
      fs.writeFileSync(
        path.join(resultDir, "error-context.md"),
        `Contact person@example.com used ${secret}`,
      );
      fs.writeFileSync(path.join(resultDir, "trace.zip"), secret);

      preparePlaywrightArtifacts({ inputDir, outputDir, secrets: [secret] });

      const report = fs.readFileSync(path.join(outputDir, "results.json"), "utf8");
      const context = fs.readFileSync(
        path.join(outputDir, "failed-test", "error-context.md"),
        "utf8",
      );
      expect(report).not.toContain(secret);
      expect(report).toContain("/f/[REDACTED_TOKEN]");
      expect(context).not.toContain(secret);
      expect(context).not.toContain("person@example.com");
      expect(fs.existsSync(path.join(outputDir, "failed-test", "trace.zip"))).toBe(
        false,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
