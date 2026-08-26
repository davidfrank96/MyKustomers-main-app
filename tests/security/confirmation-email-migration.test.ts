import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260820131919_customer_contact_confirmation_email_foundation.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const currentConfirmationMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260826095607_booking_lifecycle_payment_recording_schema.sql",
  ),
  "utf8",
);

describe("customer contact confirmation email migration", () => {
  it("stores immutable confirmation contact and a durable email event", () => {
    expect(migration).toContain("add column contact_email text");
    expect(migration).toContain("add column contact_phone text");
    expect(migration).toContain("create table public.email_events");
    expect(migration).toContain("email_events_confirmation_key unique");
    expect(migration).toContain("event_type public.email_event_type not null");
    expect(migration).not.toContain("raw_token");
  });

  it("captures contact, enriches only empty customer fields, and queues atomically", () => {
    expect(migration).toContain("p_contact_email text");
    expect(migration).toContain("for update");
    expect(migration).toContain("nullif(trim(customer_row.email), '') is null");
    expect(migration).toContain("insert into public.booking_confirmations");
    expect(migration).toContain("insert into public.email_events");
    expect(migration).toContain("'BOOKING_CONFIRMED'");
  });

  it("keeps the outbox private and exposes only service-role RPCs", () => {
    expect(migration).toContain(
      "alter table public.email_events enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.email_events from anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.confirm_booking_by_token_hash(text, text, text) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.claim_email_event(uuid) to service_role",
    );
    expect(migration).not.toContain(
      "grant select on public.email_events to authenticated",
    );
    expect(migration).not.toContain("grant select on public.email_events to anon");
  });

  it("records safe audit linkage without contact values", () => {
    expect(migration).toContain("'contact_captured', true");
    expect(migration).toContain("'email_event_id', email_event_id");
    expect(migration).not.toContain("'contact_email', normalized_contact_email");
  });

  it("preserves canonical profile contact while retaining booking-specific evidence", () => {
    expect(currentConfirmationMigration).toContain(
      "when nullif(trim(customer_row.email), '') is null then normalized_contact_email",
    );
    expect(currentConfirmationMigration).toContain("else customer_row.email");
    expect(currentConfirmationMigration).toContain(
      "insert into public.booking_confirmations",
    );
    expect(currentConfirmationMigration).toContain("normalized_contact_email");
    expect(currentConfirmationMigration).toContain(
      "notification_recipient := confirmation_row.contact_email",
    );
  });
});
