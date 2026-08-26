import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const enumMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260826032250_customer_communication_email_event_types.sql",
  ),
  "utf8",
);
const schemaMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260826032258_customer_communication_live_booking_updates_schema.sql",
  ),
  "utf8",
);

describe("customer communication migration", () => {
  it("adds only the two durable booking lifecycle event types", () => {
    expect(enumMigration).toContain("'BOOKING_RESCHEDULED'");
    expect(enumMigration).toContain("'BOOKING_DELIVERED'");
  });

  it("binds reschedule evidence to the same tenant and logical booking", () => {
    expect(schemaMigration).toContain(
      "foreign key (business_id, booking_id, booking_change_id)",
    );
    expect(schemaMigration).toContain(
      "foreign key (business_id, booking_id, confirmation_link_id)",
    );
    expect(schemaMigration).toContain("email_events_reschedule_change_unique");
    expect(schemaMigration).toContain("email_events_reschedule_link_unique");
  });

  it("creates each email event inside its authoritative domain transaction", () => {
    expect(schemaMigration).toContain(
      "create or replace function public.reschedule_booking_with_notification",
    );
    expect(schemaMigration).toContain("from public.reschedule_booking(");
    expect(schemaMigration).toContain("'BOOKING_RESCHEDULED'");
    expect(schemaMigration).toContain("'BOOKING_DELIVERED'::public.email_event_type");
    expect(schemaMigration).toContain("on conflict (booking_confirmation_id, event_type)");
  });

  it("keeps the write RPCs authenticated and denies anonymous execution", () => {
    expect(schemaMigration).toContain(
      "grant execute on function public.reschedule_booking_with_notification",
    );
    expect(schemaMigration).toContain(
      "revoke all on function public.reschedule_booking_with_notification",
    );
    expect(schemaMigration).toContain(
      "revoke all on function public.transition_booking_status",
    );
  });
});
