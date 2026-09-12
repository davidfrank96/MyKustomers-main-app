import fs from "node:fs";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync("supabase/migrations/20260912001130_pwa_notifications_foundation.sql", "utf8");
const body = (name: string) => sql.split(`create function ${name}(`)[1]?.split("\n$$;")[0] ?? "";

describe("proposed notification migration security contract (not runtime proof)", () => {
  it("separately gates scheduler activation and protects its credential/transport", () => {
    const scheduler = fs.readFileSync("supabase/migrations/20260912002523_pwa_notification_scheduler_activation.sql", "utf8");
    expect(scheduler).toContain("notification_foundation_required");
    expect(scheduler).toContain("notification_worker_secret_required");
    expect(scheduler).toContain("revoke all on schema net from public, anon, authenticated, service_role");
    expect(scheduler).toContain("url := 'https://mykustomers.com/api/internal/notifications/process'");
    expect(scheduler).toContain("timeout_milliseconds := 10000");
    expect(scheduler).toContain("'* * * * *', 'select private.invoke_notification_worker();'");
    expect(scheduler).not.toContain("vault.create_secret");
    expect(scheduler).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("enables RLS for every new table and exposes no anonymous writes", () => {
    const tables = [...sql.matchAll(/create table ([a-z_.]+) /g)].map((m) => m[1]);
    expect(tables).toHaveLength(5);
    for (const table of tables) expect(sql).toContain(`alter table ${table} enable row level security;`);
    expect(sql).not.toMatch(/grant [^;]+ to (?:public|anon);/);
    expect(sql).toContain("grant update(read_at) on public.notifications to authenticated");
    expect(sql).not.toMatch(/grant (?:all|insert|delete)[^;]*public.notifications/);
    expect(sql).toContain("user_id = (select auth.uid()) and private.notification_current_user_can_read(business_id)");
  });

  it("locks identity and quotas in subscription registration, and keeps keys out of list grants", () => {
    const register = body("public.register_push_subscription");
    expect(register).toContain("v_user uuid := auth.uid()");
    expect(register).toContain("pg_advisory_xact_lock");
    expect(register).toContain(">= 20");
    expect(register).toContain("v_existing.user_id <> v_user");
    expect(register).toContain("where push_subscriptions.user_id = v_user");
    expect(sql).toContain("grant select(id, user_id, platform, created_at, last_seen_at, revoked_at)");
    expect(sql).not.toMatch(/grant [^;]*(?:p256dh|auth_key|endpoint)[^;]* to authenticated/);
  });

  it("uses real customer transitions from the existing schema", () => {
    const addons = fs.readFileSync("supabase/migrations/20260823140111_booking_addons_customer_confirmation.sql", "utf8");
    const amendments = fs.readFileSync("supabase/migrations/20260823125121_booking_amendments_customer_reconfirmation.sql", "utf8");
    expect(addons.split(");")[0]).toContain("'AWAITING_CUSTOMER'");
    expect(amendments.split(");")[0]).toContain("'PENDING_CUSTOMER'");
    expect(sql).toMatch(/notification_addon_responded[\s\S]*?old.status = 'AWAITING_CUSTOMER' and new.status = 'CONFIRMED'/);
    expect(sql).toMatch(/notification_amendment_responded[\s\S]*?old.status = 'PENDING_CUSTOMER' and new.status = 'CONFIRMED'/);
    expect(sql).toContain("after insert on public.booking_confirmations");
    expect(sql).toContain("after insert on public.feedback");
    expect(sql).not.toMatch(/(?:before|after) (?:insert|update)[^;]* on public.bookings\s/);
  });

  it("matches the current overdue predicate and retains dedupe after history cleanup", () => {
    const query = fs.readFileSync("features/bookings/queries.ts", "utf8");
    expect(query).toContain('.lt("scheduled_for", now)');
    expect(query).toContain('.not("status", "in", "(DELIVERED,COMPLETED,CANCELLED)")');
    expect(body("public.process_overdue_notifications")).toContain("b.scheduled_for < now() and b.status not in ('DELIVERED', 'COMPLETED', 'CANCELLED')");
    expect(body("public.process_overdue_notifications")).toContain("for update of b skip locked");
    expect(sql).toContain("unique (user_id, dedupe_key)");
    expect(sql).toContain("unique (notification_id, subscription_id)");
    expect(body("public.maintain_notifications")).not.toContain("delete from private.notification_overdue_receipts");
  });

  it("rechecks membership, disabled accounts, preferences and subscription generation before claiming", () => {
    expect(fs.readFileSync("features/businesses/onboarding.ts", "utf8")).toContain("1970-01-01T00:00:00.000Z");
    expect(body("private.notification_recipient_allowed")).toContain("b.onboarding_completed_at <> 'epoch'::timestamptz");
    expect(body("private.notification_user_enabled")).toContain("u.deleted_at is null");
    expect(body("private.notification_user_enabled")).toContain("u.banned_until <= now()");
    const claim = body("public.claim_notification_push");
    for (const check of ["notification_recipient_allowed", "notification_push_enabled", "s.generation = d.subscription_generation", "n.read_at is null", "s.revoked_at is null"]) expect(claim).toContain(check);
    expect(sql).toContain("notification_membership_removed after delete on public.business_members");
    expect(sql).toContain("foreign key (notification_id, user_id)");
    expect(sql).toContain("foreign key (subscription_id, user_id)");
  });

  it("bounds retries and does not blindly repeat ambiguous sends", () => {
    expect(body("public.claim_notification_push")).toContain("set state = 'unknown'");
    const finish = body("public.finish_notification_push");
    expect(finish).toContain("p_http_status in (404, 410)");
    expect(finish).toContain("v_delivery.attempt_count < 3");
    expect(finish).toContain("p_retry_after_seconds > 3600");
    expect(finish).toContain("d.lease_token = p_lease_token");
    expect(finish).toContain("s.generation = v_delivery.subscription_generation");
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain("interval '7 days'");
  });

  it("leaves domain workflows, network delivery and recurring infrastructure outside the migration", () => {
    expect(sql).not.toMatch(/(?:update|delete from|alter table) public\.(bookings|customers|email_events|booking_confirmations|feedback)\b/);
    expect(sql).not.toContain("net.http");
    expect(sql).not.toContain("cron.schedule");
    expect(sql).not.toContain("create extension");
    expect(sql.trim()).toMatch(/commit;$/);
    const functions = [...sql.matchAll(/create function [\s\S]*?\bas \$\$/g)];
    for (const [signature] of functions) expect(signature).toContain("security definer set search_path = ''");
    expect(sql).toContain("revoke all on function %s from public, anon, authenticated, service_role");
  });
});
