import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "supabase/migrations/20260824133925_trusted_feedback_sharing.sql",
  "utf8",
);
const actions = fs.readFileSync("features/feedback/actions.ts", "utf8");
const publicFeedback = fs.readFileSync("features/feedback/public.ts", "utf8");

describe("trusted feedback sharing security", () => {
  it("adds safe share/open events and an idempotent valid-link open field", () => {
    expect(migration).toContain("'FEEDBACK_SHARE_INITIATED'");
    expect(migration).toContain("'FEEDBACK_OPENED'");
    expect(migration).toContain("add column if not exists first_opened_at timestamptz");
    expect(migration).toContain("feedback_link.first_opened_at is null");
    expect(migration).toContain("feedback_link.purpose = 'booking_feedback'");
    expect(migration).toContain("booking.status = 'COMPLETED'");
  });

  it("keeps the first-open RPC service-only", () => {
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.record_feedback_link_open(text)",
    );
    expect(migration).toContain(
      "grant execute on function public.record_feedback_link_open(text) to service_role",
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.record_feedback_link_open\(text\) to (anon|authenticated)/,
    );
  });

  it("tenant-validates share tracking and keeps raw capabilities out of audit metadata", () => {
    expect(actions).toContain('.eq("business_id", business.id)');
    expect(actions).toContain('.eq("booking_id", bookingId)');
    expect(actions).toContain('.eq("purpose", "booking_feedback")');
    expect(actions).toContain('.eq("status", "COMPLETED")');
    expect(actions).toContain('eventType: "FEEDBACK_SHARE_INITIATED"');
    expect(actions).not.toMatch(/metadata:\s*\{[^}]*token/s);
    expect(actions).not.toMatch(/metadata:\s*\{[^}]*feedbackUrl/s);
    expect(publicFeedback).toContain('consumeFeedbackRateLimit("feedback_open")');
  });
});
