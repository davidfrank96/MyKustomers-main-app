import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260901194500_delivery_feedback_automation.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const bookingActions = fs.readFileSync(
  path.join(process.cwd(), "features/bookings/actions.ts"),
  "utf8",
);
const feedbackActions = fs.readFileSync(
  path.join(process.cwd(), "features/feedback/actions.ts"),
  "utf8",
);
const outbox = fs.readFileSync(path.join(process.cwd(), "lib/email/outbox.ts"), "utf8");
const deliveredTemplate = fs.readFileSync(
  path.join(process.cwd(), "lib/email/templates/booking-delivered.ts"),
  "utf8",
);
const publicFeedback = fs.readFileSync(
  path.join(process.cwd(), "features/feedback/public.ts"),
  "utf8",
);

describe("delivery-to-feedback automation migration", () => {
  it("preserves the exact approved migration artifact", () => {
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "7ad964608538057bd041b745fa7005e7cb75a7e01264dade2a41ef48b8071ba7",
    );
  });

  it("requires one correctly shaped Vault key without creating or exposing it", () => {
    expect(migration).toContain("mykustomers_feedback_capability_hmac_v1");
    expect(migration).toContain("v_secret_count <> 1");
    expect(migration).toContain("v_secret !~ '^[0-9a-f]{64}$'");
    expect(migration).not.toContain("vault.create_secret");
    expect(migration).not.toMatch(/grant[^;]+vault\.decrypted_secrets/i);
  });

  it("versions capabilities and rejects caller-forged version-one hashes", () => {
    expect(migration).toContain("add column token_version smallint not null default 0");
    expect(migration).toContain("extensions.hmac(");
    expect(migration).toContain("feedback_links_enforce_v1_integrity");
    expect(migration).toContain("feedback_capability_v1_hash_mismatch");
    expect(migration).toContain("new.token_hash is distinct from v_expected_hash");
  });

  it("atomically binds one delivery event to its exact feedback capability", () => {
    expect(migration).toContain("deliver_booking_with_feedback");
    expect(migration).toContain("email_events_delivery_feedback_booking_unique");
    expect(migration).toContain("email_events_feedback_link_business_booking_fk");
    expect(migration).toContain("bookings_require_delivery_feedback_transaction");
    expect(migration.indexOf("private.create_feedback_capability_v1")).toBeLessThan(
      migration.indexOf(
        "public.transition_booking_status(",
        migration.indexOf("deliver_booking_with_feedback"),
      ),
    );
  });

  it("keeps dispatch exact, bounded, and valid after automatic completion", () => {
    const dispatch = migration.slice(
      migration.indexOf("get_delivery_feedback_dispatch_context"),
      migration.indexOf("enforce_delivery_event_feedback_association"),
    );
    expect(dispatch).toContain("event.feedback_link_id");
    expect(dispatch).toContain("interval '48 hours'");
    expect(dispatch).toContain("'DELIVERED'::public.booking_status");
    expect(dispatch).toContain("'COMPLETED'::public.booking_status");
    expect(dispatch).not.toMatch(/order by feedback_link\.created_at/i);
  });

  it("auto-completes only paid delivered bookings with feedback", () => {
    expect(migration).toContain("try_auto_complete_delivered_booking");
    expect(migration).toContain(
      "p_source not in ('feedback_submission', 'payment_recording')",
    );
    expect(migration).toContain("v_totals.outstanding_amount_minor <> 0");
    expect(migration).toContain("v_booking.status <> 'DELIVERED'");
  });

  it("uses the new narrow RPCs throughout the application without browser token derivation", () => {
    expect(bookingActions).toContain('rpc("deliver_booking_with_feedback"');
    expect(feedbackActions).toContain('rpc("create_or_recover_booking_feedback_link"');
    expect(feedbackActions).not.toContain("generateFeedbackToken");
    expect(outbox).toContain('rpc("get_delivery_feedback_dispatch_context"');
    expect(outbox).toContain(
      '.eq("feedback_link_id", dispatchContext.data.feedback_link_id)',
    );
    expect(publicFeedback).toContain('booking.status !== "DELIVERED"');
    expect(publicFeedback).toContain('booking.status !== "COMPLETED"');
    expect(deliveredTemplate).toContain('label: "Leave feedback"');
    expect(deliveredTemplate).toContain("feedbackAlreadySubmitted");
  });

  it("keeps every privileged function on an empty search path and least privilege grants", () => {
    for (const functionName of [
      "deliver_booking_with_feedback",
      "create_or_recover_booking_feedback_link",
      "get_delivery_feedback_dispatch_context",
      "submit_feedback_by_token_hash",
      "record_booking_payment",
    ]) {
      const start = migration.indexOf(`function public.${functionName}`);
      expect(start).toBeGreaterThan(-1);
      expect(migration.slice(start, start + 1_500)).toContain("set search_path = ''");
    }
    expect(migration).toContain(
      "grant execute on function public.deliver_booking_with_feedback(uuid)\nto authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_delivery_feedback_dispatch_context(uuid)\nto service_role",
    );
    expect(migration).toContain(
      "revoke all on function public.create_booking_feedback_link(",
    );
  });
});
