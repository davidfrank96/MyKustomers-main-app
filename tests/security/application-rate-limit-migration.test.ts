import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260902010040_auth_application_rate_limit_foundation.sql",
  ),
  "utf8",
);
const limiter = fs.readFileSync(
  path.join(process.cwd(), "lib/security/rate-limit.ts"),
  "utf8",
);
const limiterKeys = fs.readFileSync(
  path.join(process.cwd(), "lib/security/rate-limit-key.ts"),
  "utf8",
);
const authLimiter = fs.readFileSync(
  path.join(process.cwd(), "features/auth/rate-limit.ts"),
  "utf8",
);
const publicLimiter = fs.readFileSync(
  path.join(process.cwd(), "features/confirmation-links/rate-limit.ts"),
  "utf8",
);

describe("application rate-limit migration boundary", () => {
  it("defines atomic structured consumption, clearing, bounded cleanup, and compatibility", () => {
    expect(migration).toContain("create or replace function public.consume_application_rate_limit(");
    expect(migration).toContain("insert into public.confirmation_rate_limits as current_bucket");
    expect(migration).toContain("on conflict (bucket_key, action) do update");
    expect(migration).toContain("create or replace function public.clear_application_rate_limit(");
    expect(migration).toContain("create or replace function public.cleanup_application_rate_limits(");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("from public.consume_application_rate_limit(");
    expect(migration).toContain("confirmation_rate_limits_updated_at_idx");
  });

  it("keeps every privileged function postgres-owned, empty-search-path, and service-role-only", () => {
    expect(migration.match(/security definer/g)).toHaveLength(4);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(4);
    expect(migration.match(/owner to postgres;/g)).toHaveLength(4);
    expect(migration.match(/from public, anon, authenticated;/g)).toHaveLength(5);
    expect(migration.match(/to service_role;/g)).toHaveLength(4);
    expect(migration).not.toMatch(/grant execute[^;]+to (public|anon|authenticated)/i);
  });

  it("rejects raw identities and unbounded policy inputs", () => {
    expect(migration).toContain("p_bucket_key !~ '^[a-f0-9]{64}$'");
    expect(migration).toContain("char_length(p_action) > 80");
    expect(migration).toContain("p_max_requests > 10000");
    expect(migration).toContain("p_window_seconds > 86400");
    expect(migration).toContain("p_batch_size > 5000");
    expect(limiterKeys).toContain("hkdfSync(");
    expect(limiterKeys).toContain("createHmac(");
    expect(limiter).toContain('requestHeaders.get("x-forwarded-for")');
    expect(limiter).not.toMatch(/x-real-ip|user-agent/i);
    expect(limiter).not.toMatch(/new Map|new Set/);
  });

  it("locks layered Auth and public capability/source policy in repository evidence", () => {
    expect(authLimiter).toContain(
      "login: { maxRequests: 8, windowSeconds: 900, blockSeconds: 300 }",
    );
    expect(authLimiter).toContain(
      "signup: { maxRequests: 3, windowSeconds: 3_600, blockSeconds: 3_600 }",
    );
    expect(authLimiter).toContain(
      "recovery: { maxRequests: 3, windowSeconds: 3_600, blockSeconds: 3_600 }",
    );
    expect(authLimiter).toContain('action: "auth_resend_cooldown"');
    expect(authLimiter).toContain("maxRequests: 1, windowSeconds: 60");
    expect(publicLimiter).toContain('action: `${action}_source`');
    expect(publicLimiter).toContain('action: `${action}_capability`');
  });
});
