import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260902104919_customer_email_source_of_truth.sql",
  ),
  "utf8",
);

describe("customer email source-of-truth migration", () => {
  it("keeps public confirmation email as booking evidence without profile mutation", () => {
    expect(migration).toContain(
      "-- Confirmation contact is booking-scoped evidence. Never enrich profile email.",
    );
    expect(migration).toContain("insert into public.booking_confirmations");
    expect(migration).toContain("normalized_contact_email");
    expect(migration).not.toMatch(/set\s+email\s*=/i);
  });

  it("removes every implicit customer-profile email fallback", () => {
    expect(migration).not.toMatch(/customer\.email/i);
    expect(migration).toContain(
      "customer_email := private.normalize_customer_contact_email(\n    confirmation_row.contact_email",
    );
    expect(migration).toContain(
      "notification_recipient := private.normalize_customer_contact_email(\n      confirmation_row.contact_email",
    );
  });

  it("creates no outbox recipient when booking contact evidence is absent", () => {
    expect(migration).toContain(
      "if confirmation_row.id is not null and notification_recipient is not null then",
    );
    expect(migration).not.toContain("delivery_email_recipient_required");
    expect(migration).toContain("if v_transition.email_event_id is not null then");
  });

  it("preserves the strict version-1 feedback capability boundary for manual delivery", () => {
    expect(migration).toContain("feedback_link.token_version = 1");
    expect(migration).toContain("feedback_link.purpose = 'booking_feedback'");
    expect(migration).toContain("feedback_link.used_at is null");
    expect(migration).toContain("feedback_link.revoked_at is null");
    expect(migration).toContain("feedback_link.expires_at > statement_timestamp()");
    expect(migration).toContain("delivery_transition_requires_feedback_capability");
  });

  it("retains hardened function ownership, search paths, and grants", () => {
    expect(migration.match(/security definer/g)?.length).toBe(7);
    expect(migration.match(/set search_path = ''/g)?.length).toBe(7);
    expect(migration).toContain(
      "grant execute on function public.confirm_booking_by_token_hash(text, text, text)\nto service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.deliver_booking_with_feedback(uuid)\nto authenticated",
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
