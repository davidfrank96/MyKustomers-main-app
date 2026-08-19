import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260819001954_phase_8_private_feedback_issues.sql",
  "utf8",
);

describe("Phase 8 migration security structure", () => {
  it("creates private feedback capability and issue tables", () => {
    expect(migration).toContain("create table if not exists public.feedback_links");
    expect(migration).toContain("create table if not exists public.feedback");
    expect(migration).toContain("create table if not exists public.booking_issues");
    expect(migration).toContain("constraint feedback_rating_range check (overall_rating between 1 and 5)");
    expect(migration).toContain("constraint feedback_booking_key unique (booking_id)");
    expect(migration).toContain("constraint feedback_comment_plain");
  });

  it("keeps feedback links purpose-separated from confirmation links", () => {
    expect(migration).toContain("constraint feedback_links_purpose_check check (purpose = 'booking_feedback')");
    expect(migration).toContain("create or replace function public.get_feedback_public_view");
    expect(migration).toContain("create or replace function public.submit_feedback_by_token_hash");
    expect(migration).not.toContain("purpose = 'booking_confirmation'");
  });

  it("restricts table grants and uses RLS", () => {
    expect(migration).toContain("alter table public.feedback_links enable row level security");
    expect(migration).toContain("alter table public.feedback enable row level security");
    expect(migration).toContain("alter table public.booking_issues enable row level security");
    expect(migration).toContain("revoke all on public.feedback_links from anon, authenticated");
    expect(migration).toContain("grant select on public.feedback to authenticated");
    expect(migration).toContain("grant select, insert, update on public.booking_issues to authenticated");
    expect(migration).toContain("using (private.is_business_member(business_id))");
    expect(migration).not.toContain("grant insert on public.feedback to authenticated");
  });

  it("restricts SECURITY DEFINER RPC execution to intended roles", () => {
    expect(migration).toContain(
      "revoke all on function public.create_booking_feedback_link(uuid, text, timestamptz) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.create_booking_feedback_link(uuid, text, timestamptz) to authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_feedback_public_view(text) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.submit_feedback_by_token_hash(text, integer, boolean, boolean, text) to service_role",
    );
  });

  it("records audit events without storing customer comments in audit metadata", () => {
    expect(migration).toContain("FEEDBACK_LINK_CREATED");
    expect(migration).toContain("FEEDBACK_LINK_REVOKED");
    expect(migration).toContain("FEEDBACK_LINK_REGENERATED");
    expect(migration).toContain("FEEDBACK_SUBMITTED");
    expect(migration).toContain("ISSUE_CREATED");
    expect(migration).toContain("ISSUE_RESOLVED");
    expect(migration).not.toContain("'comment', clean_comment");
    expect(migration).not.toContain("'description', parsed");
  });
});
