import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260824223141_platform_admin_authorization_foundation.sql",
  ),
  "utf8",
);
const adminServer = fs.readFileSync(path.join(root, "lib/admin/server.ts"), "utf8");
const adminLayout = fs.readFileSync(path.join(root, "app/admin/layout.tsx"), "utf8");

describe("platform admin authorization foundation", () => {
  it("uses a dedicated explicit role and status model", () => {
    expect(migration).toContain(
      "create type public.platform_admin_role as enum ('SUPER_ADMIN')",
    );
    expect(migration).toContain(
      "create type public.platform_admin_status as enum ('ACTIVE', 'DISABLED')",
    );
    expect(migration).toContain("create table public.platform_admins");
    expect(migration).toContain("status public.platform_admin_status not null default 'DISABLED'");
    expect(migration).toContain("user_id uuid primary key references auth.users(id)");
    expect(migration).not.toMatch(/profiles[\s\S]{0,120}(is_admin|platform_admin)/i);
  });

  it("denies browser table access and exposes only a self-scoped active lookup", () => {
    expect(migration).toContain(
      "alter table public.platform_admins enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.platform_admins from public, anon, authenticated",
    );
    expect(migration).not.toMatch(/create policy[\s\S]+on public\.platform_admins/i);
    expect(migration).toContain("create or replace function public.get_my_platform_admin()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("platform_admin.user_id = (select auth.uid())");
    expect(migration).toContain("platform_admin.status = 'ACTIVE'");
    expect(migration).toContain(
      "grant execute on function public.get_my_platform_admin() to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.get_my_platform_admin() to anon",
    );
  });

  it("audits creation, changes, and disablement without logging page access", () => {
    expect(migration).toContain("'PLATFORM_ADMIN_CREATED'");
    expect(migration).toContain("'PLATFORM_ADMIN_UPDATED'");
    expect(migration).toContain("'PLATFORM_ADMIN_DISABLED'");
    expect(migration).toContain("create trigger platform_admins_audit_change");
    expect(migration).toContain("'target_user_id'");
    expect(adminLayout).not.toContain("audit_logs");
  });

  it("keeps authorization server-only and independent from tenant membership", () => {
    expect(adminServer.startsWith('import "server-only";')).toBe(true);
    expect(adminServer).toContain('rpc("get_my_platform_admin")');
    expect(adminServer).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(adminServer).not.toContain("@/lib/supabase/admin");
    expect(adminServer).not.toContain("business_members");
    expect(adminLayout).toContain('requireUser("/admin")');
    expect(adminLayout).toContain("requirePlatformAdminRole");
    expect(adminLayout).not.toContain("getCurrentBusinessContext");
  });
});
