import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const providerFiles = [
  "lib/email/provider.ts",
  "lib/email/providers/brevo.ts",
  "lib/email/providers/development.ts",
  "lib/email/providers/resend.ts",
  "lib/email/providers/shared.ts",
].map(read);

describe("Brevo transactional email security boundary", () => {
  it("keeps provider credentials server-only and out of public configuration", () => {
    expect(read("lib/config/server-env.ts")).toContain("BREVO_API_KEY");
    expect(read("lib/config/public-env.ts")).not.toMatch(
      /BREVO|RESEND|TRANSACTIONAL_EMAIL_FROM/,
    );
    expect(read(".env.example")).toContain("BREVO_API_KEY=");
    expect(read(".env.example")).not.toContain("NEXT_PUBLIC_BREVO");
    for (const source of providerFiles) expect(source).toContain('import "server-only"');
  });

  it("keeps Brevo out of business workflows and uses the existing atomic outbox claim", () => {
    const workflowFiles = [
      "features/confirmation-links/public-actions.ts",
      "features/bookings/actions.ts",
      "features/amendments/actions.ts",
      "features/amendments/public-actions.ts",
      "features/addons/actions.ts",
      "features/addons/public-actions.ts",
      "features/feedback/actions.ts",
    ].map(read);
    for (const source of workflowFiles)
      expect(source.toLowerCase()).not.toContain("brevo");

    const outbox = read("lib/email/outbox.ts");
    expect(outbox).toContain('supabase.rpc(\n    "claim_email_event"');
    expect(outbox).toContain('.eq("status", "SENDING")');
    expect(outbox).not.toMatch(/from\("bookings"\)[\s\S]{0,200}\.update\(/);
  });

  it("does not log recipients, message bodies, credentials, or provider responses", () => {
    for (const source of providerFiles) {
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
    const brevo = read("lib/email/providers/brevo.ts");
    expect(brevo).not.toMatch(/contacts|campaigns|marketing/i);
    expect(brevo).not.toMatch(/response\.(text|arrayBuffer|blob)\(/);
  });

  it("retains development and Resend adapters behind the same provider interface", () => {
    const resolver = read("lib/email/provider.ts");
    expect(resolver).toContain('config.provider === "development"');
    expect(resolver).toContain('config.provider === "brevo"');
    expect(resolver).toContain('config.provider === "resend"');
    expect(resolver).toContain("unavailableEmailProvider");
  });
});
