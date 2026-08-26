import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260825095217_platform_admin_read_only_email_operations.sql",
  ),
  "utf8",
);
const queries = fs.readFileSync(path.join(root, "features/admin/queries.ts"), "utf8");
const pages = ["app/admin/emails/page.tsx", "app/admin/emails/[emailEventId]/page.tsx"]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
const listPage = fs.readFileSync(path.join(root, "app/admin/emails/page.tsx"), "utf8");

const directoryFunction = migration.slice(
  migration.indexOf(
    "create or replace function public.get_platform_admin_email_operations",
  ),
  migration.indexOf("create or replace function public.get_platform_admin_email_event("),
);
const detailFunction = migration.slice(
  migration.indexOf("create or replace function public.get_platform_admin_email_event("),
);

describe("platform admin read-only email operations boundary", () => {
  it("defines two narrow self-authorizing security-definer RPCs", () => {
    for (const functionName of [
      "get_platform_admin_email_operations",
      "get_platform_admin_email_event",
    ]) {
      expect(migration).toContain(`create or replace function public.${functionName}`);
      expect(migration).toContain(`revoke all on function public.${functionName}`);
      expect(migration).toContain(`grant execute on function public.${functionName}`);
      expect(queries).toContain(`rpc("${functionName}"`);
    }
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(
      migration.match(/perform private\.require_platform_admin_read_access\(\)/g),
    ).toHaveLength(2);
    expect(migration.match(/owner to postgres;/g)).toHaveLength(3);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3);
    expect(migration.match(/to authenticated;/g)).toHaveLength(2);
    expect(migration).not.toMatch(/grant execute[^;]+to (public|anon)/i);
  });

  it("uses bounded range presets, literal search, and stable server pagination", () => {
    expect(migration).toContain("left(coalesce(p_search, ''), 80)");
    expect(migration).toContain("array['ALL', 'PENDING', 'SENDING', 'SENT', 'FAILED']");
    expect(migration).toContain("when 'today'");
    expect(migration).toContain("when '7d'");
    expect(migration).toContain("when '30d'");
    expect(migration).toContain("limit v_page_size");
    expect(migration).toContain("offset (v_page - 1) * v_page_size");
    expect(migration).toContain("order by matching.created_at desc, matching.id desc");
    expect(migration).not.toMatch(/ilike|similar to|regexp_matches/);
  });

  it("keeps directory identity minimal and failure details sanitized", () => {
    expect(directoryFunction).not.toMatch(
      /recipient_email|failure_code|failure_message|provider_message_id|customer_id|html|text_body|token_hash/i,
    );
    expect(detailFunction).toContain(
      "private.mask_contact_email(email_event.recipient_email)",
    );
    expect(detailFunction).toContain(
      "private.classify_email_failure(email_event.failure_code)",
    );
    expect(detailFunction).not.toMatch(
      /failure_message|provider_message_id|customer_id|html|text_body|token_hash/i,
    );
    expect(pages).not.toMatch(
      /provider_message_id|failure_message|failure_code|recipient_email|html body|text body|authorization token/i,
    );
  });

  it("keeps the feature read-only and independent from tenant selection", () => {
    expect(migration).not.toMatch(/insert into|update public\.|delete from|truncate /i);
    expect(queries.startsWith('import "server-only";')).toBe(true);
    expect(queries.match(/await requirePlatformAdmin\(\)/g)).toHaveLength(11);
    expect(queries).not.toMatch(
      /createServiceRoleClient|getCurrentBusinessContext|getSelectedBusinessId/,
    );
    expect(listPage).not.toMatch(
      /retry|resend|send again|mark pending|mark failed|mark sent/i,
    );
  });

  it("returns each page and detail in one database call without direct table grants", () => {
    expect(queries.match(/rpc\("get_platform_admin_email_operations"/g)).toHaveLength(1);
    expect(queries.match(/rpc\("get_platform_admin_email_event"/g)).toHaveLength(1);
    expect(pages).not.toContain("createClient");
    expect(migration).not.toMatch(/grant select[^;]*email_events/i);
  });
});
