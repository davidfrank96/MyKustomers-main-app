import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823120902_confirmed_booking_integrity_cancellation_notification.sql",
  ),
  "utf8",
);
const rpcFixMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823122133_cancellation_rpc_ambiguous_reference_fix.sql",
  ),
  "utf8",
);

describe("confirmed booking integrity and cancellation notification migration", () => {
  it("locks all material terms after confirmation with only controlled rescheduling", () => {
    for (const field of [
      "customer_id",
      "title",
      "description",
      "currency",
      "total_amount_minor",
      "deposit_amount_minor",
      "scheduled_for",
    ]) {
      expect(migration).toContain(
        `old_booking.${field} is distinct from new_booking.${field}`,
      );
    }

    expect(migration).toContain("customer_confirmed_material_terms_locked");
    expect(migration).toContain("reschedule_allowed");
    expect(migration).toContain("old.status = 'AWAITING_CUSTOMER'");
    expect(migration).toContain("private.revoke_open_confirmation_links");
  });

  it("creates one cancellation event atomically using confirmation contact first", () => {
    expect(migration).toContain("add value if not exists 'BOOKING_CANCELLED'");
    expect(migration).toContain("unique (booking_confirmation_id, event_type)");
    expect(migration).toContain(
      "cancellation_recipient := confirmation_row.contact_email",
    );
    expect(migration).toContain("if cancellation_recipient is null then");
    expect(migration).toContain("insert into public.email_events");
    expect(migration).toContain(
      "on conflict (booking_confirmation_id, event_type) do nothing",
    );
  });

  it("keeps cancellation authenticated, tenant-scoped, reasoned, and least-privileged", () => {
    expect(migration).toContain("private.is_business_member(booking_row.business_id)");
    expect(migration).toContain("cancellation_reason_required");
    expect(migration).toContain("cancellation_reason_must_be_plain_text");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.transition_booking_status(uuid, public.booking_status, text)",
    );
    expect(migration).toContain("to authenticated, service_role");
  });

  it("qualifies cancellation RPC columns that overlap table return names", () => {
    expect(rpcFixMigration).toContain("confirmation.booking_id = booking_row.id");
    expect(rpcFixMigration).toContain(
      "event.booking_confirmation_id = confirmation_row.id",
    );
    expect(rpcFixMigration).toContain("set search_path = ''");
  });
});
