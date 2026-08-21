import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260821125815_business_identity_logo_storage.sql",
  ),
  "utf8",
);
const uploadRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/businesses/[businessId]/logo/route.ts"),
  "utf8",
);
const runtimeFixMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260821132030_business_identity_runtime_fixes.sql",
  ),
  "utf8",
);

describe("business identity and logo storage migration", () => {
  it("stores only bounded logo references and safe websites in businesses", () => {
    expect(migration).toContain("add column if not exists website text");
    expect(migration).toContain("add column if not exists logo_path text");
    expect(migration).toContain("businesses_website_safe_url");
    expect(migration).toContain("businesses_logo_path_format");
    expect(migration).not.toContain("bytea");
  });

  it("creates one public-logo bucket with strict persisted limits", () => {
    expect(migration).toContain("'business-logos'");
    expect(migration).toContain("204800");
    expect(migration).toContain("array['image/webp']::text[]");
    expect(migration).toMatch(/'business-logos',[\s\S]*true,[\s\S]*204800/);
  });

  it("restricts exact-path object writes and listing to active owners", () => {
    expect(migration).toContain("object_name <> folder_parts[1] || '/logo.webp'");
    expect(migration).toContain("array['owner']::public.business_member_role[]");
    expect(migration).toContain("for insert\nto authenticated");
    expect(migration).toContain("for update\nto authenticated");
    expect(migration).toContain("for delete\nto authenticated");
    expect(migration).not.toMatch(/for (insert|update|delete)[\s\S]{0,30}to anon/);
  });

  it("uses the authenticated Supabase client rather than storage administrator secrets", () => {
    expect(uploadRoute).toContain('createClient()');
    expect(uploadRoute).toContain('requireBusinessRole(parsedBusinessId.data, ["owner"]');
    expect(uploadRoute).not.toContain("createServiceRoleClient");
    expect(uploadRoute).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("adds only public business identity to confirmation output", () => {
    expect(migration).toContain("'business_logo_path', business_row.logo_path");
    expect(migration).toContain("'business_website', business_row.website");
    expect(migration).toContain("'business_instagram', business_row.instagram");
    expect(migration).not.toContain("'business_id', business_row.id");
    expect(runtimeFixMigration).toContain(
      "'contact_email_masked', private.mask_contact_email(confirmation_row.contact_email)",
    );
  });

  it("preserves legacy onboarding calls without an ambiguous defaulted overload", () => {
    expect(runtimeFixMigration).toContain("drop function public.create_business_onboarding(");
    expect(runtimeFixMigration).toContain("business_website text\n)");
    expect(runtimeFixMigration).not.toContain("business_website text default null");
  });
});
