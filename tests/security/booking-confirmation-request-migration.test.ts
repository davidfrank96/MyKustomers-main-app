import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enumMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260901090010_booking_confirmation_request_event_type.sql",
  ),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260901090011_booking_confirmation_request_outbox.sql",
  ),
  "utf8",
);
const outbox = fs.readFileSync(path.join(process.cwd(), "lib/email/outbox.ts"), "utf8");

describe("booking confirmation request outbox migration", () => {
  it("splits the enum commit boundary from dependent SQL", () => {
    expect(enumMigration).toContain(
      "add value if not exists 'BOOKING_CONFIRMATION_REQUESTED'",
    );
    expect(enumMigration).not.toContain("create_booking_confirmation_request");
    expect(migration).not.toMatch(/alter\s+type\s+public\.email_event_type/i);
  });

  it("preserves the local part and lowercases only the domain", () => {
    expect(migration).toContain("private.normalize_customer_contact_email");
    expect(migration).toContain("lower(split_part(trim(input_email), '@', 2))");
    expect(migration).not.toContain("lower(trim(p_contact_email))");
    expect(migration).not.toContain("lower(trim(p_new_customer_email))");
    for (const functionName of [
      "create_booking_with_customer",
      "confirm_booking_by_token_hash",
      "create_booking_amendment",
      "submit_booking_addon",
      "reschedule_booking_with_notification",
      "transition_booking_status",
    ]) {
      expect(migration).toContain(`function public.${functionName}`);
    }
  });

  it("creates one durable request event for the exact link", () => {
    expect(migration).toContain("create_booking_confirmation_request");
    expect(migration).toContain("for update");
    expect(migration).toContain("private.is_business_member(booking_row.business_id)");
    expect(migration).toContain("email_events_confirmation_request_link_unique");
    expect(migration).toContain("where event_type = 'BOOKING_CONFIRMATION_REQUESTED'");
    expect(migration).toContain("inserted_link_id");
    expect(migration).toContain("'duplicate_ignored'::text");
  });

  it("replaces the old capability and creates link, event, and audit atomically", () => {
    const revoke = migration.indexOf("private.revoke_open_confirmation_links");
    const link = migration.indexOf("insert into public.confirmation_links", revoke);
    const event = migration.indexOf("insert into public.email_events", link);
    const audit = migration.indexOf("insert into public.audit_logs", event);
    expect(revoke).toBeGreaterThan(-1);
    expect(revoke).toBeLessThan(link);
    expect(link).toBeLessThan(event);
    expect(event).toBeLessThan(audit);
  });

  it("does not backfill events and exposes only authenticated RPC execution", () => {
    expect(migration).not.toContain("historical_backfill");
    expect(migration).not.toMatch(/update\s+public\.email_events\s+set\s+event_type/i);
    expect(migration).toContain(
      "revoke all on function public.create_booking_confirmation_request(uuid, text, text, timestamptz)",
    );
    expect(migration).toContain("to authenticated");
  });

  it("reconstructs delivery only from the event's exact active confirmation link", () => {
    expect(outbox).toContain('event.event_type === "BOOKING_CONFIRMATION_REQUESTED"');
    expect(outbox).toContain('.eq("id", event.confirmation_link_id)');
    expect(outbox).toContain('confirmationUrl.pathname.startsWith("/c/")');
    expect(outbox).toContain("link.revoked_at");
    expect(outbox).toContain("link.used_at");
  });
});
