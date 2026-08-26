import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260826195655_admin_phase_7_security_health.sql"),
  "utf8",
);
const serverBoundary = fs.readFileSync(
  path.join(root, "features/admin/health-server.ts"),
  "utf8",
);
const pageBoundary = [
  "app/admin/security/page.tsx",
  "components/admin/admin-security-health.tsx",
  "components/admin/admin-health-refresh.tsx",
]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
const publicHealthRoute = fs.readFileSync(
  path.join(root, "app/api/health/route.ts"),
  "utf8",
);

const healthFunction = migration.slice(
  migration.indexOf(
    "create or replace function public.get_platform_admin_health_summary()",
  ),
  migration.indexOf(
    "create or replace function public.get_platform_admin_security_activity(",
  ),
);
const activityFunction = migration.slice(
  migration.indexOf(
    "create or replace function public.get_platform_admin_security_activity(",
  ),
);

describe("platform admin Security & Health migration boundary", () => {
  it("defines two bounded active-admin-only read RPCs", () => {
    for (const functionName of [
      "get_platform_admin_health_summary",
      "get_platform_admin_security_activity",
    ]) {
      expect(migration).toContain(`create or replace function public.${functionName}`);
      expect(migration).toContain(`revoke all on function public.${functionName}`);
      expect(migration).toContain(`grant execute on function public.${functionName}`);
    }

    expect(migration.match(/language plpgsql/g)).toHaveLength(2);
    expect(migration.match(/stable\nsecurity definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration.match(/owner to postgres;/g)).toHaveLength(2);
    expect(
      migration.match(/perform private\.require_platform_admin_read_access\(\)/g),
    ).toHaveLength(2);
    expect(migration.match(/from public, anon, authenticated;/g)).toHaveLength(2);
    expect(migration.match(/to authenticated;/g)).toHaveLength(2);
    expect(migration).not.toMatch(/grant execute[^;]+to (public|anon)/i);
  });

  it("keeps the migration read-only and independent of tenant selection", () => {
    expect(migration).not.toMatch(
      /\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b|\btruncate\b/i,
    );
    expect(migration).not.toMatch(
      /business_members|current_business|get_current_business|selected_business/i,
    );
    expect(migration).not.toMatch(/grant\s+select\s+on\s+(table\s+)?/i);
    expect(serverBoundary.startsWith('import "server-only";')).toBe(true);
    expect(serverBoundary.match(/await requirePlatformAdmin\(\)/g)).toHaveLength(2);
    expect(serverBoundary).not.toContain("requirePrivilegedPlatformAdmin");
    expect(serverBoundary).not.toMatch(
      /createServiceRoleClient|getCurrentBusinessContext|getSelectedBusinessId/,
    );
  });

  it("uses the established 15-minute outbox threshold and bounded live aggregates", () => {
    expect(healthFunction).toContain("v_now - interval '15 minutes'");
    expect(healthFunction).toContain("v_now - interval '24 hours'");
    expect(healthFunction).toContain("'stale_email_threshold_minutes', 15");
    expect(healthFunction).toContain("'minimal_read_succeeded', true");
    expect(healthFunction).toContain("'accepted_24h'");
    expect(healthFunction).toContain("'failed_attempts_24h'");
    expect(healthFunction).toContain("'stale_pending'");
    expect(healthFunction).toContain("'stale_sending'");
    expect(healthFunction).toContain("'oldest_pending_at'");
    expect(healthFunction).toContain("'open'");
    expect(healthFunction).toContain("'oldest_open_at'");
    expect(healthFunction).toContain("'overdue'");
    expect(healthFunction).toContain("'active'");
    expect(healthFunction).toContain("'disabled'");
  });

  it("returns only allowlisted platform security activity", () => {
    for (const eventType of [
      "PLATFORM_ADMIN_CREATED",
      "PLATFORM_ADMIN_UPDATED",
      "PLATFORM_ADMIN_DISABLED",
      "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
      "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
      "PLATFORM_ADMIN_EMAIL_RETRY_FAILED",
    ]) {
      expect(activityFunction).toContain(`'${eventType}'::public.audit_event_type`);
    }

    expect(activityFunction).toContain("least(greatest(coalesce(p_limit, 12), 1), 20)");
    expect(activityFunction).toContain("limit v_limit");
    expect(activityFunction).toContain("order by audit.created_at desc, audit.id desc");
    expect(activityFunction).toContain("left(recent.metadata ->> 'reason', 500)");
    expect(activityFunction).not.toContain("'metadata',");
  });

  it("excludes customer, communication, credential, and session material", () => {
    expect(migration).not.toMatch(
      /recipient_email|customer_email|customer_phone|booking_description|internal_notes|email_body|failure_message|provider_message_id|token_hash|totp|access_token|refresh_token|session_id|api_key|service_role/i,
    );
    expect(activityFunction).not.toMatch(
      /raw_user_meta_data|raw_app_meta_data|identities/,
    );
  });

  it("does not add a remediation or page-view audit path", () => {
    expect(migration).not.toMatch(
      /repair|self.?heal|switch.?provider|retry_email|create.?admin|disable.?admin/i,
    );
    expect(migration).not.toMatch(/page_view|route_view|health_viewed/i);
    expect(pageBoundary).not.toMatch(
      /switch to resend|create admin|disable admin|repair now|retry delivery/i,
    );
    expect(pageBoundary).not.toMatch(/window\.confirm|window\.prompt/);
    expect(pageBoundary).toContain("router.refresh()");
    expect(pageBoundary).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("keeps each database source to one server RPC", () => {
    expect(
      serverBoundary.match(/rpc\("get_platform_admin_health_summary"/g),
    ).toHaveLength(1);
    expect(
      serverBoundary.match(/rpc\("get_platform_admin_security_activity"/g),
    ).toHaveLength(1);
  });

  it("keeps the public health endpoint minimal and separate", () => {
    expect(publicHealthRoute).toContain('status: "ok"');
    expect(publicHealthRoute).not.toMatch(
      /supabase|database|provider|email|admin|count|environment|commit|secret|key/i,
    );
  });
});
