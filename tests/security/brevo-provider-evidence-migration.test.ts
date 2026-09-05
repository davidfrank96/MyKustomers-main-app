import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const file = "supabase/migrations/20260904144304_brevo_delivery_evidence.sql";
const sql = fs.readFileSync(path.join(process.cwd(), file), "utf8");
const ingest = sql.slice(
  sql.indexOf("create function public.ingest_brevo_transactional_event("),
  sql.indexOf("-- Sticky terminal outcomes"),
);
const table = sql.slice(
  sql.indexOf("create table public.email_provider_events"),
  sql.indexOf("create index email_provider_events_event_history_idx"),
);

describe("Brevo provider evidence migration contract", () => {
  it("records the approval boundary and is transactional with bounded DDL waits", () => {
    expect(sql).toContain("APPROVAL-ONLY DRAFT. NOT APPLIED.");
    expect(sql).toContain("begin;");
    expect(sql.trimEnd()).toMatch(/commit;$/);
    expect(sql).toContain("set local lock_timeout = '5s'");
    expect(sql).toContain("set local statement_timeout = '60s'");
  });
  it("does not mutate or backfill existing application rows", () => {
    expect(sql).not.toMatch(
      /(?:update|delete from|insert into) public\.(?:email_events|email_delivery_attempts|bookings|confirmation_links)\b/i,
    );
    expect(sql).not.toMatch(
      /alter type|create policy|create extension|http_post|pg_net|vault\./i,
    );
    expect(ingest.match(/insert into public\./g)).toHaveLength(1);
  });
  it("minimizes persisted evidence and requires exact event/attempt association", () => {
    expect(table).toContain("foreign key (delivery_attempt_id, email_event_id)");
    expect(table).toContain("event_fingerprint text not null unique");
    expect(table).not.toMatch(
      /recipient|subject|payload|sending_ip|user_agent|mirror|capability|message_id/,
    );
    expect(sql).toContain("before update or delete on public.email_provider_events");
    expect(sql).toContain("before truncate on public.email_provider_events");
  });
  it("denies direct browser/service table access and public ingestion execution", () => {
    expect(sql).toContain(
      "alter table public.email_provider_events enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.email_provider_events from public, anon, authenticated, service_role",
    );
    expect(sql).toMatch(
      /revoke all on function public\.ingest_brevo_transactional_event\(text,text,bigint,text\)\s+from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.ingest_brevo_transactional_event\(text,text,bigint,text\)\s+to service_role/,
    );
  });
  it("derives idempotency internally and serializes same-message and same-attempt callbacks", () => {
    expect(ingest).toContain("pg_advisory_xact_lock");
    expect(ingest).toContain("for key share");
    expect(ingest).toContain("for update");
    expect(ingest).toContain("on conflict (event_fingerprint) do nothing");
    expect(ingest).toContain("'DUPLICATE'");
    expect(ingest).toContain("p_event_epoch::text");
    expect(ingest).not.toMatch(/p_email_event_id|p_recipient|p_fingerprint/);
  });
  it("fails closed on ambiguous, mismatched, wrong-provider and unknown correlations", () => {
    expect(ingest).toContain("attempt.provider = 'brevo'");
    expect(ingest).toContain("coalesce(cardinality(v_message_ids), 0) > 1");
    expect(ingest).toContain("v_attempt_id <> v_correlation_ids[1]");
    expect(ingest).toContain("is distinct from v_key");
    expect(ingest).toContain("'CORRELATION_CONFLICT'");
    expect(ingest).toContain("'UNMATCHED'");
    expect(ingest).toContain("v_time < v_attempt.started_at - interval '5 minutes'");
  });
  it("uses provider chronology with sticky terminal evidence, never receipt order", () => {
    expect(sql).toContain("when 'COMPLAINT' then 80 when 'BLOCKED' then 70");
    expect(sql).toContain("when 'HARD_BOUNCED' then 50 when 'DELIVERED' then 40 else 0");
    expect(sql).toMatch(
      /order by private\.email_provider_state_rank\(evidence.event_type\) desc,\s+evidence.provider_event_at desc/,
    );
    expect(sql).toContain("order by delivery.attempt_number desc limit 1");
    expect(sql).toContain(
      "private.brevo_message_key(attempt.provider_message_id) = evidence.message_key",
    );
  });
  it("has bounded admin reads and explicit tenant membership before vendor projection", () => {
    expect(
      sql.match(/perform private.require_platform_admin_read_access\(\)/g),
    ).toHaveLength(3);
    expect(sql).toContain("cardinality(p_email_event_ids), 0) > 20");
    expect(sql).toContain("limit 50");
    const vendor = sql.slice(
      sql.indexOf("create function public.get_booking_confirmation_delivery("),
    );
    expect(vendor).toContain("if auth.uid() is null");
    expect(vendor).toContain("not private.is_business_member(v_business_id)");
    expect(vendor).toContain("event.business_id = v_business_id");
    expect(vendor).toContain("event.confirmation_link_id = v_link_id");
  });
  it("separates external acceptance, development operations and unknown history", () => {
    expect(sql).toContain("'external_accepted'");
    expect(sql).toContain(
      "and provider in ('brevo', 'resend') and provider_message_id is not null",
    );
    expect(sql).toContain("and not development");
    expect(sql).toContain("'development_operations'");
    expect(sql).toContain("'unknown_provider_operations'");
    expect(sql).toContain("'brevo_outcomes'");
  });
  it("ships one authenticated endpoint after approval without putting its secret in SQL", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "app/api/webhooks/brevo/transactional/route.ts"),
      "utf8",
    );
    expect(route).toContain("BREVO_WEBHOOK_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("BREVO_WEBHOOK_MAX_BODY_BYTES");
    expect(sql).not.toContain("BREVO_WEBHOOK_SECRET");
  });
});
