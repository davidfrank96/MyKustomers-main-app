import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260901230527_delivery_feedback_require_v1_association.sql",
  ),
  "utf8",
);

describe("delivery feedback forward tightening migration", () => {
  it("preserves the immutable originally prepared artifact", () => {
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "397dbaaa6fab4fb78902e13ef3273054d629df2316bfd0dd593d210d7cb9e6c4",
    );
    // The applied artifact remains hash-locked, including its preparation-time
    // header; operational state is recorded in the migration ledger and release docs.
    expect(migration).toContain("PREPARED, NOT APPLIED");
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });

  it("fails closed when a post-convergence delivery is not exactly v1-associated", () => {
    expect(migration).toContain("2026-09-01 22:21:08+00");
    expect(migration).toContain("delivery_feedback_tightening_precondition_failed");
    expect(migration).toContain("event.feedback_link_id is null");
    expect(migration).toContain("feedback_link.id is null");
    expect(migration).toContain("feedback_link.token_version <> 1");
    expect(migration).toContain("feedback_link.purpose <> 'booking_feedback'");
  });

  it("restores strict non-null enforcement only through the two deferred functions", () => {
    expect(migration.match(/create or replace function/g)).toHaveLength(2);
    expect(migration).toContain("private.enforce_delivery_event_feedback_association()");
    expect(migration).toContain("private.enforce_new_delivery_transaction()");
    expect(migration).toContain("new_delivery_event_requires_feedback_capability");
    expect(migration).toContain(
      "delivery_transition_requires_feedback_event_association",
    );
    expect(migration).not.toContain("if v_delivery_event.feedback_link_id is null then");
    expect(migration).not.toMatch(/\b(create|alter|drop)\s+table\b/i);
    expect(migration).not.toMatch(/\b(create|drop)\s+(unique\s+)?index\b/i);
    expect(migration).not.toMatch(/\b(create|drop)\s+trigger\b/i);
  });

  it("retains tenant-exact least-privilege function hardening", () => {
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration.match(/owner to postgres/g)).toHaveLength(2);
    expect(
      migration.match(/from public, anon, authenticated, service_role/g),
    ).toHaveLength(2);
    expect(migration).toContain("feedback_link.business_id = event.business_id");
    expect(migration).toContain("feedback_link.booking_id = event.booking_id");
    expect(migration).not.toMatch(/grant\s+execute/i);
  });
});
