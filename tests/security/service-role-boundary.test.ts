import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scannedDirs = ["app", "components", "features", "hooks"];

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("service-role boundary", () => {
  it("does not import service-role helpers from client components", () => {
    const clientFiles = scannedDirs
      .flatMap((dir) => listSourceFiles(path.join(root, dir)))
      .filter((file) => fs.readFileSync(file, "utf8").startsWith('"use client";'));

    const violations = clientFiles.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return (
        source.includes("SUPABASE_SERVICE_ROLE_KEY") ||
        source.includes("@/lib/config/server-env") ||
        source.includes("@/lib/supabase/admin")
      );
    });

    expect(violations).toEqual([]);
  });
});
