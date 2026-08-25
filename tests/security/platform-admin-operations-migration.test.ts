import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260825022135_platform_admin_read_only_booking_issue_operations.sql",
  ),
  "utf8",
);
const queries = fs.readFileSync(path.join(root, "features/admin/queries.ts"), "utf8");
const pages = [
  "app/admin/bookings/page.tsx",
  "app/admin/bookings/[bookingId]/page.tsx",
  "app/admin/issues/page.tsx",
  "app/admin/issues/[issueId]/page.tsx",
]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

const operationFunctions = [
  "get_platform_admin_bookings",
  "get_platform_admin_booking",
  "get_platform_admin_issues",
  "get_platform_admin_issue",
];

describe("platform admin read-only booking and issue operations boundary", () => {
  it("defines four narrow self-authorizing security-definer RPCs", () => {
    for (const functionName of operationFunctions) {
      expect(migration).toContain(`create or replace function public.${functionName}`);
      expect(migration).toContain(`revoke all on function public.${functionName}`);
      expect(migration).toContain(`grant execute on function public.${functionName}`);
      expect(queries).toContain(`rpc("${functionName}"`);
    }
    expect(migration.match(/security definer/g)).toHaveLength(4);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(4);
    expect(migration.match(/owner to postgres;/g)).toHaveLength(4);
    expect(migration.match(/perform private\.require_platform_admin_read_access\(\)/g)).toHaveLength(4);
    expect(migration.match(/to authenticated;/g)).toHaveLength(4);
    expect(migration).not.toMatch(/grant execute[^;]+to (public|anon)/i);
  });

  it("keeps all privileged calls server-only, admin-first, and tenant-context independent", () => {
    expect(queries.startsWith('import "server-only";')).toBe(true);
    expect(queries.match(/await requirePlatformAdmin\(\)/g)).toHaveLength(11);
    expect(queries).not.toMatch(/createServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/);
    expect(queries).not.toMatch(/getCurrentBusinessContext|getSelectedBusinessId/);
  });

  it("uses bounded literal search and stable server pagination", () => {
    expect(migration.match(/left\(coalesce\(p_search, ''\), 80\)/g)).toHaveLength(2);
    expect(migration.match(/least\(greatest\(coalesce\(p_page_size, 20\), 1\), 50\)/g)).toHaveLength(2);
    expect(migration.match(/order by matching\.created_at desc, matching\.id desc/g)).toHaveLength(2);
    expect(migration).toContain("position(v_search in lower(booking.reference)) > 0");
    expect(migration).toContain("position(v_search in replace(lower(issue.category::text), '_', ' ')) > 0");
    expect(migration).not.toMatch(/ilike|similar to|regexp_matches/);
  });

  it("counts booking rows once and adds confirmed add-ons only to effective totals", () => {
    expect(migration).toContain("'total', (select count(*) from matching)");
    expect(migration).toContain("addon.status = 'CONFIRMED'::public.booking_addon_status");
    expect(migration).toContain("booking.total_amount_minor + coalesce((");
    expect(migration).not.toMatch(/count\([^)]*booking_addons/i);
  });

  it("minimizes directory and detail payloads", () => {
    expect(migration).not.toMatch(/internal_notes|confirmation_terms_hash|token_hash|terms_hash|provider_id|recipient_email|failure_message|failure_code/);
    expect(migration).not.toMatch(/feedback\.comment|'comment'/i);
    expect(migration).toContain("private.mask_contact_email(confirmation.contact_email)");
    expect(migration).toContain("'overall_rating', feedback.overall_rating");
    expect(migration).toContain("'email_summary'");
    expect(migration).toContain("group by email_event.event_type, email_event.status");
  });

  it("keeps issue descriptions detail-only and every surface read-only", () => {
    const listFunction = migration.slice(
      migration.indexOf("create or replace function public.get_platform_admin_issues"),
      migration.indexOf("create or replace function public.get_platform_admin_issue("),
    );
    expect(listFunction).not.toContain("issue.description");
    expect(migration).not.toMatch(/insert into|update public\.|delete from|truncate /i);
    expect(pages).not.toMatch(/resolve issue|reopen|cancel booking|edit booking|impersonate|suspend/i);
    expect(pages).not.toMatch(/internal_notes|token_hash|recipient_email|failure_message|feedback\.comment/);
  });

  it("uses one database call per directory and one structured call per detail", () => {
    expect(queries.match(/rpc\("get_platform_admin_bookings"/g)).toHaveLength(1);
    expect(queries.match(/rpc\("get_platform_admin_booking"/g)).toHaveLength(1);
    expect(queries.match(/rpc\("get_platform_admin_issues"/g)).toHaveLength(1);
    expect(queries.match(/rpc\("get_platform_admin_issue"/g)).toHaveLength(1);
    expect(pages).not.toContain("createClient");
  });
});
