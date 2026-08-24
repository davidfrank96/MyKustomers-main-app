import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260824094523_select_current_business_for_booking_creation.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const compatibilityMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260824100357_preserve_single_business_booking_compatibility.sql",
  ),
  "utf8",
);

describe("multi-business booking migration", () => {
  it("replaces first-membership inference with exact active membership validation", () => {
    expect(migration).toContain("p_business_id uuid");
    expect(migration).toContain("membership.business_id = p_business_id");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).not.toContain("order by membership.created_at");
  });

  it("keeps the function security definer boundary hardened", () => {
    expect(migration).toContain("actor_user_id uuid := auth.uid()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(") from public, anon, authenticated;");
    expect(migration).toContain(") to authenticated;");
    expect(migration).not.toContain(") to anon;");
  });

  it("keeps the deployed legacy caller safe during rollout", () => {
    expect(compatibilityMigration).toContain("active_membership_count > 1");
    expect(compatibilityMigration).toContain("explicit_business_required");
    expect(compatibilityMigration).toContain(
      "public.create_booking_with_customer(\n    selected_business_id",
    );
    expect(compatibilityMigration).toContain("security definer");
    expect(compatibilityMigration).toContain(") to authenticated;");
    expect(compatibilityMigration).not.toContain(") to anon;");
  });
});
