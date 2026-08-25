import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260825003219_platform_admin_read_only_directories.sql",
  ),
  "utf8",
);
const queries = fs.readFileSync(path.join(root, "features/admin/queries.ts"), "utf8");
const pages = [
  "app/admin/businesses/page.tsx",
  "app/admin/businesses/[businessId]/page.tsx",
  "app/admin/users/page.tsx",
  "app/admin/users/[userId]/page.tsx",
]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

const directoryFunctions = [
  "get_platform_admin_businesses",
  "get_platform_admin_business",
  "get_platform_admin_users",
  "get_platform_admin_user",
];

describe("platform admin read-only directory boundary", () => {
  it("defines four narrow self-authorizing security-definer RPCs", () => {
    for (const functionName of directoryFunctions) {
      expect(migration).toContain(`create or replace function public.${functionName}`);
      expect(migration).toContain(`revoke all on function public.${functionName}`);
      expect(migration).toContain(`grant execute on function public.${functionName}`);
    }

    expect(migration.match(/security definer/g)).toHaveLength(4);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(5);
    expect(migration.match(/owner to postgres;/g)).toHaveLength(5);
    expect(
      migration.match(/perform private\.require_platform_admin_read_access\(\)/g),
    ).toHaveLength(4);
    expect(migration).toContain("platform_admin.user_id = auth.uid()");
    expect(migration).toContain("platform_admin.role = 'SUPER_ADMIN'");
    expect(migration).toContain("platform_admin.status = 'ACTIVE'");
    expect(migration).toContain("using errcode = '42501'");
  });

  it("permits authenticated invocation but denies direct helper access", () => {
    expect(migration).toContain(
      "revoke all on function private.require_platform_admin_read_access()",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toMatch(
      /grant execute on function private\.require_platform_admin_read_access/,
    );
    expect(migration.match(/to authenticated;/g)).toHaveLength(4);
  });

  it("projects only the approved Auth fields and provider names", () => {
    expect(migration).toContain("auth_user.email");
    expect(migration).toContain("auth_user.created_at");
    expect(migration).toContain("auth_user.last_sign_in_at");
    expect(migration).toContain("auth_user.email_confirmed_at");
    expect(migration).toContain("identity.provider");
    expect(migration).not.toMatch(
      /encrypted_password|confirmation_token|recovery_token|email_change_token|raw_app_meta_data|raw_user_meta_data|identity_data|access_token|refresh_token|session_id/i,
    );
  });

  it("bounds pagination and treats search punctuation as literal text", () => {
    expect(migration.match(/left\(coalesce\(p_search, ''\), 80\)/g)).toHaveLength(2);
    expect(
      migration.match(/least\(greatest\(coalesce\(p_page_size, 20\), 1\), 50\)/g),
    ).toHaveLength(2);
    expect(
      migration.match(/order by matching\.created_at desc, matching\.id desc/g),
    ).toHaveLength(2);
    expect(migration).toContain("position(v_search in lower(business.name)) > 0");
    expect(migration).toContain(
      "position(v_search in lower(coalesce(auth_user.email, ''))) > 0",
    );
    expect(migration).not.toMatch(/ilike|similar to|regexp_matches/);
  });

  it("preserves every active owner instead of collapsing to a primary owner", () => {
    expect(migration).toContain("jsonb_agg(");
    expect(migration).toContain("membership.role = 'owner'");
    expect(migration).toContain("'owners', coalesce(owner_rows.owners, '[]'::jsonb)");
    expect(migration).not.toMatch(/owner_rows[\s\S]{0,120}limit 1/i);
  });

  it("keeps privileged access server-only, admin-first, and independent of vendor context", () => {
    expect(queries.startsWith('import "server-only";')).toBe(true);
    expect(queries.match(/await requirePlatformAdmin\(\)/g)).toHaveLength(11);
    for (const functionName of directoryFunctions) {
      expect(queries).toContain(`rpc("${functionName}"`);
    }
    expect(queries).not.toMatch(/createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);
    expect(queries).not.toMatch(/getCurrentBusinessContext|getSelectedBusinessId/);
  });

  it("keeps all directory surfaces read-only and omits customer or booking rows", () => {
    expect(migration).not.toMatch(/insert into|update public\.|delete from|truncate /i);
    expect(pages).not.toMatch(/delete|suspend|disable user|impersonate|edit business/i);
    expect(pages).not.toMatch(
      /customer name|booking title|recipient email|failure message/i,
    );
    expect(pages).not.toContain("createServiceRoleClient");
  });
});
