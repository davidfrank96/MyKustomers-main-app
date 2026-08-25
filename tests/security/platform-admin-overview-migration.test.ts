import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260825003000_platform_admin_read_only_overview.sql",
  ),
  "utf8",
);
const queries = fs.readFileSync(
  path.join(root, "features/admin/queries.ts"),
  "utf8",
);
const page = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");

describe("platform admin read-only overview", () => {
  it("uses one narrow self-authorizing aggregate RPC", () => {
    expect(migration).toContain(
      "create or replace function public.get_platform_admin_overview()",
    );
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("platform_admin.user_id = auth.uid()");
    expect(migration).toContain("platform_admin.role = 'SUPER_ADMIN'");
    expect(migration).toContain("platform_admin.status = 'ACTIVE'");
    expect(migration).toContain("using errcode = '42501'");
  });

  it("denies anonymous and ordinary callers while returning aggregates only", () => {
    expect(migration).toContain(
      "revoke all on function public.get_platform_admin_overview()",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.get_platform_admin_overview()",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).not.toMatch(/recipient_email|failure_message|provider_message_id/);
    expect(migration).not.toContain("business_id',");
  });

  it("reuses authoritative booking, issue, and email status definitions", () => {
    expect(migration).toContain("'COMPLETED'::public.booking_status");
    expect(migration).toContain("'CANCELLED'::public.booking_status");
    expect(migration).toContain("'DELIVERED'::public.booking_status");
    expect(migration).toContain("'OPEN'::public.booking_issue_status");
    expect(migration).toContain("'PENDING'::public.email_event_status");
    expect(migration).toContain("'SENDING'::public.email_event_status");
    expect(migration).toContain("'SENT'::public.email_event_status");
    expect(migration).toContain("'FAILED'::public.email_event_status");
    expect(migration).toContain("at time zone 'UTC'");
    expect(migration).not.toMatch(/booking_amendments|booking_addons/);
  });

  it("keeps privileged reads in the admin boundary and independent of vendor context", () => {
    expect(queries.startsWith('import "server-only";')).toBe(true);
    expect(queries).toContain("await requirePlatformAdmin()");
    expect(queries).toContain('rpc("get_platform_admin_overview")');
    expect(queries).not.toContain("createServiceRoleClient");
    expect(queries).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(queries).not.toContain("getCurrentBusinessContext");
    expect(queries).not.toContain("getSelectedBusinessId");
  });

  it("does not introduce financial claims, row-level PII, or write controls", () => {
    expect(page).not.toMatch(/revenue|profit|gmv|recipient email|customer name/i);
    expect(page).not.toMatch(/suspend|disable user|delete business|impersonate/i);
    expect(page).not.toContain("total_amount_minor");
  });
});
