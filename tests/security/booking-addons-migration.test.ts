import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823140111_booking_addons_customer_confirmation.sql",
  ),
  "utf8",
).toLowerCase();
const parentIntegrityMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823141800_booking_addon_parent_currency_integrity.sql",
  ),
  "utf8",
).toLowerCase();
const idempotencyMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823142231_booking_addon_email_idempotency_fix.sql",
  ),
  "utf8",
).toLowerCase();

describe("booking add-ons migration", () => {
  it("creates structured parent-consistent add-on and purpose-owned link records", () => {
    expect(migration).toContain("create table public.booking_addons");
    expect(migration).toContain("create table public.booking_addon_confirmation_links");
    expect(migration).toContain("booking_addons_booking_business_fk");
    expect(migration).toContain("booking_addon_confirmation");
    expect(migration).toContain("booking_addons_status_shape");
    expect(migration).not.toContain("scheduled_for timestamptz not null");
  });

  it("enforces money, matching parent currency, one pending request, and immutability", () => {
    expect(migration).toContain("booking_addons_total_nonnegative");
    expect(migration).toContain("booking_addons_deposit_not_greater_than_total");
    expect(migration).toContain("booking_addon_currency_mismatch");
    expect(parentIntegrityMigration).toContain(
      "booking_addons_enforce_parent_consistency",
    );
    expect(parentIntegrityMigration).toContain("booking_addon_parent_mismatch");
    expect(parentIntegrityMigration).toContain("booking_addon_currency_mismatch");
    expect(migration).toContain("booking_addons_one_awaiting_per_booking_idx");
    expect(migration).toContain("booking_addon_terms_immutable");
    expect(migration).toContain("booking_addon_workflow_required");
  });

  it("uses narrow tenant and service-only capability boundaries", () => {
    expect(migration).toContain(
      "alter table public.booking_addons enable row level security",
    );
    expect(migration).toContain(
      "alter table public.booking_addon_confirmation_links enable row level security",
    );
    expect(migration).toContain("using (private.is_business_member(business_id))");
    expect(migration).toContain("grant select on public.booking_addons to authenticated");
    expect(migration).toContain(
      "grant execute on function public.confirm_booking_addon_by_token_hash(text)\nto service_role",
    );
    expect(migration).not.toContain(
      "grant execute on function public.confirm_booking_addon_by_token_hash(text)\nto anon",
    );
    expect(migration).toContain("set search_path = ''");
  });

  it("integrates conflicts, lifecycle cancellation, email idempotency, and analytics", () => {
    expect(migration).toContain("booking_has_pending_amendment_request");
    expect(migration).toContain("booking_has_pending_addon_request");
    expect(migration).toContain("bookings_handle_pending_addons");
    expect(migration).toContain("booking_rescheduled");
    expect(migration).toContain("email_events_addon_request_unique");
    expect(migration).toContain("email_events_addon_confirm_unique");
    expect(idempotencyMigration).toContain(
      "where event_type = 'booking_addon_confirmed'",
    );
    expect(idempotencyMigration).toContain(
      "where event_type = ''booking_addon_confirmed'' do nothing",
    );
    expect(migration).toContain("booking_addon_requested");
    expect(migration).toContain("booking_addon_confirmed");
    expect(migration).toContain("public.get_business_insights");
    expect(migration).toContain("addon.status = ''confirmed''");
  });
});
