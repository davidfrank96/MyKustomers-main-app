import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823125121_booking_amendments_customer_reconfirmation.sql",
  ),
  "utf8",
);
const revocationFix = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823131332_booking_amendment_revocation_resolution_fix.sql",
  ),
  "utf8",
);
const idempotencyFix = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823131517_booking_amendment_email_idempotency_fix.sql",
  ),
  "utf8",
);

describe("booking amendments migration", () => {
  it("stores structured pending and effective evidence without changing the booking on proposal", () => {
    expect(migration).toContain("create table public.booking_amendments");
    expect(migration).toContain("old_terms jsonb not null");
    expect(migration).toContain("proposed_terms jsonb not null");
    expect(migration).toContain("base_terms_hash text not null");
    expect(migration).toContain("changed_fields text[] not null");
    const createBody =
      migration.split("create or replace function public.create_booking_amendment")[1] ??
      "";
    expect(
      createBody.split("create or replace function public.revoke_booking_amendment")[0],
    ).not.toContain("update public.bookings");
  });

  it("uses a purpose-specific hash-only token and one pending request", () => {
    expect(migration).toContain("purpose = 'booking_amendment_confirmation'");
    expect(migration).toContain("booking_amendments_token_hash_format");
    expect(migration).toContain("booking_amendments_one_pending_per_booking_idx");
    expect(migration).toContain("where status = 'PENDING_CUSTOMER'");
    expect(migration).not.toContain(" raw_token ");
  });

  it("keeps the Phase A lock and opens only the constrained amendment setting", () => {
    expect(migration).toContain("customer_confirmed_material_terms_locked");
    expect(migration).toContain("app.booking_amendment_allowed");
    expect(migration).toContain("booking_row.status not in ('CONFIRMED', 'IN_PROGRESS')");
    expect(migration).toContain(
      "confirmation_terms_hash is distinct from amendment_row.base_terms_hash",
    );
  });

  it("locks down new tables and public RPCs with explicit grants", () => {
    expect(migration).toContain(
      "alter table public.booking_amendments enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.booking_amendments from anon, authenticated",
    );
    expect(migration).toContain("using (private.is_business_member(business_id))");
    expect(migration).toContain(
      "grant execute on function public.confirm_booking_amendment_by_token_hash(text)\nto service_role",
    );
    expect(migration).toContain("set search_path = ''");
  });

  it("revokes pending requests on cancellation, lifecycle advancement, and reschedule", () => {
    expect(migration).toContain("p_to_status in ('READY', 'CANCELLED')");
    expect(migration).toContain("'booking_cancelled'");
    expect(migration).toContain("'booking_advanced'");
    expect(migration).toContain("'booking_rescheduled'");
  });

  it("keeps live-found revocation and email race fixes forward-only", () => {
    expect(revocationFix).toContain("v_reason := reason");
    expect(revocationFix).toContain("revoked_reason = left(v_reason, 80)");
    expect(idempotencyFix).toContain("unique (booking_amendment_id, event_type)");
  });
});
