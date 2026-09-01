import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260901205018_delivery_feedback_legacy_compatibility.sql",
  ),
  "utf8",
);

describe("delivery feedback legacy compatibility migration", () => {
  it("preserves the exact approved incident hotfix", () => {
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "183af91b911c97e77717a60f8f9f9c1f23e6432dffed2a1b88a4d8d6b44009bb",
    );
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });

  it("changes only the two diagnosed deferred compatibility functions", () => {
    expect(migration.match(/create or replace function/g)).toHaveLength(2);
    expect(migration).toContain(
      "private.enforce_delivery_event_feedback_association()",
    );
    expect(migration).toContain("private.enforce_new_delivery_transaction()");
    expect(migration).not.toMatch(/\b(create|alter|drop)\s+table\b/i);
    expect(migration).not.toMatch(/\b(create|drop)\s+(unique\s+)?index\b/i);
    expect(migration).not.toMatch(/\b(create|drop)\s+trigger\b/i);
  });

  it("temporarily accepts only the legacy null association shape", () => {
    expect(migration).toContain("if v_event.feedback_link_id is null then");
    expect(migration).toContain("if v_delivery_event.feedback_link_id is null then");
    expect(migration).toContain("v_delivery_event_count <> 1");
    expect(migration).toContain(
      "delivery_transition_requires_feedback_event_association",
    );
  });

  it("keeps every non-null association tenant-exact, v1, and immutable", () => {
    expect(migration).toContain("delivery_feedback_association_immutable");
    expect(migration).toContain(
      "feedback_link.business_id = v_event.business_id",
    );
    expect(migration).toContain("feedback_link.booking_id = v_event.booking_id");
    expect(migration).toContain("v_link.token_version <> 1");
    expect(migration).toContain("v_link.purpose <> 'booking_feedback'");
    expect(migration).toContain("feedback_link.token_version = 1");
    expect(migration).toContain("feedback_link.purpose = 'booking_feedback'");
  });

  it("retains hardened ownership and no browser-role execution", () => {
    expect(migration.match(/security definer/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration.match(/owner to postgres/g)).toHaveLength(2);
    expect(migration.match(/from public, anon, authenticated, service_role/g)).toHaveLength(
      2,
    );
    expect(migration).not.toMatch(/grant\s+execute/i);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/i);
  });
});
