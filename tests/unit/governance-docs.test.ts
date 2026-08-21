import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requiredDocs = [
  "AGENTS.md",
  "README.md",
  "database/README.md",
  "docs/MASTER_PLAN.md",
  "docs/PRODUCT_SPEC.md",
  "docs/PHASES.md",
  "docs/DATA_MODEL.md",
  "docs/DECISIONS.md",
  "docs/DESIGN_SYSTEM.md",
  "docs/TESTING.md",
  "docs/CHANGELOG.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/architecture.md",
  "docs/security.md",
  "docs/development.md",
  "docs/product-boundaries.md",
  "docs/ANALYTICS_DEFINITIONS.md",
  "docs/DOCUMENTATION_GOVERNANCE.md",
  "docs/MIGRATIONS.md",
  "docs/RESPONSIVE_QA.md",
];

describe("repository governance", () => {
  it("keeps required documentation present and the documentation rule permanent", () => {
    for (const file of requiredDocs) {
      expect(fs.existsSync(path.join(process.cwd(), file)), `${file} is required`).toBe(true);
    }

    const agentGuidance = fs.readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf8");
    expect(agentGuidance.toLowerCase()).toContain("documentation is part of definition of done");
    expect(agentGuidance).toContain("Final task reports");
  });

  it("keeps Supabase migrations uniquely named and ordered", () => {
    const migrationDir = path.join(process.cwd(), "supabase/migrations");
    const migrations = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql"));
    const versions = migrations.map((file) => {
      expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
      return file.slice(0, 14);
    });

    expect(new Set(versions).size).toBe(versions.length);
    expect(migrations).toEqual([...migrations].sort());
  });
});
