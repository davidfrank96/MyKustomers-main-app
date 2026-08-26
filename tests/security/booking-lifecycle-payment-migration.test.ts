import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const enumMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260826095555_booking_lifecycle_payment_recording.sql",
  ),
  "utf8",
).toLowerCase();
const schemaMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260826095607_booking_lifecycle_payment_recording_schema.sql",
  ),
  "utf8",
).toLowerCase();

describe("booking lifecycle and payment recording migrations", () => {
  it("defines an append-only tenant payment ledger with RLS and no authenticated writes", () => {
    expect(schemaMigration).toContain("create table public.booking_payments");
    expect(schemaMigration).toContain("unique (business_id, booking_id, operation_id)");
    expect(schemaMigration).toContain("alter table public.booking_payments enable row level security");
    expect(schemaMigration).toContain("grant select on table public.booking_payments to authenticated");
    expect(schemaMigration).not.toMatch(
      /grant\s+(insert|update|delete)[^;]*booking_payments[^;]*authenticated/,
    );
    expect(schemaMigration).toContain(
      "using (private.is_business_member(business_id))",
    );
  });

  it("keeps payment authority in locked security-definer RPCs", () => {
    expect(schemaMigration).toContain(
      "create or replace function public.get_booking_payment_summary",
    );
    expect(schemaMigration).toContain(
      "create or replace function public.record_booking_payment",
    );
    expect(schemaMigration).toContain("for update;");
    expect(schemaMigration).toContain("payment_exceeds_outstanding_balance");
    expect(schemaMigration).toContain("booking_not_eligible_for_payment_recording");
    expect(schemaMigration).toContain("set search_path = ''");
    expect(schemaMigration).toContain(
      "grant execute on function public.record_booking_payment(uuid, bigint, uuid)\nto authenticated",
    );
    expect(schemaMigration).toContain("revoke all on function public.record_booking_payment");
  });

  it("records customer confirmation as work in progress and gates completion on payment", () => {
    expect(schemaMigration).toMatch(
      /status = 'confirmed'[\s\S]*status = 'in_progress'/,
    );
    expect(schemaMigration).toContain(
      "if payment_totals.outstanding_amount_minor > 0 then",
    );
    expect(schemaMigration).toContain("raise exception 'outstanding_balance'");
    expect(enumMigration).toContain("'booking_payment_recorded'");
    expect(schemaMigration).toContain("'booking_payment_recorded'");
  });

  it("does not backfill or replay existing production records", () => {
    expect(schemaMigration).not.toMatch(/update\s+public\.bookings\s+set/);
    expect(schemaMigration).not.toMatch(/insert\s+into\s+public\.booking_payments\s+select/);
    expect(schemaMigration).not.toContain("claim_email_event");
  });
});
