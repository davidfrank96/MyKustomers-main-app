import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260819010145_phase_9_business_insights_analytics.sql",
);
const fixMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260819011341_phase_9_fix_insights_current_time.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const fixMigration = fs.readFileSync(fixMigrationPath, "utf8");

describe("Phase 9 analytics migration", () => {
  it("adds a narrow authenticated analytics RPC without public aggregate access", () => {
    expect(migration).toContain("create or replace function public.get_business_insights");
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("not private.is_business_member(p_business_id)");
    expect(migration).toContain("raise exception 'Not authorized to access analytics for this business'");
    expect(migration).toContain(
      "revoke all on function public.get_business_insights(uuid, timestamptz, timestamptz)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.get_business_insights(uuid, timestamptz, timestamptz)",
    );
    expect(migration).toContain("to authenticated");
  });

  it("documents status, date, currency, feedback, and issue aggregate rules in SQL", () => {
    expect(migration).toContain("b.status not in ('DRAFT', 'CANCELLED')");
    expect(migration).toContain("b.status = 'COMPLETED'");
    expect(migration).toContain("b.completed_at >= p_from");
    expect(migration).toContain("b.cancelled_at >= p_from");
    expect(migration).toContain("group by b.currency");
    expect(migration).toContain("avg(f.overall_rating)");
    expect(migration).toContain("group by i.category");
    expect(migration).toContain("b.delivered_at <= b.scheduled_for");
  });

  it("adds only justified indexes and no analytics tables, views, or materialized views", () => {
    expect(migration).toContain("bookings_business_created_at_idx");
    expect(migration).toContain("bookings_business_status_completed_at_idx");
    expect(migration).toContain("feedback_business_submitted_at_idx");
    expect(migration).toContain("booking_issues_business_created_at_idx");
    expect(migration).not.toMatch(/create\s+table/i);
    expect(migration).not.toMatch(/create\s+(materialized\s+)?view/i);
  });

  it("uses a follow-up migration for the applied current_time fix", () => {
    expect(fixMigration).toContain("pg_get_functiondef");
    expect(fixMigration).toContain("v_current_time");
    expect(fixMigration).toContain("b.scheduled_for < v_current_time");
    expect(fixMigration).toContain("grant execute on function public.get_business_insights");
  });
});
