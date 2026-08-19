import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818234428_phase_7_fulfilment_operational_lifecycle.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("phase 7 operational lifecycle migration", () => {
  it("adds operational timestamps and cancellation reason to bookings", () => {
    expect(migration).toContain("add column if not exists started_at timestamptz");
    expect(migration).toContain("add column if not exists ready_at timestamptz");
    expect(migration).toContain("add column if not exists delivered_at timestamptz");
    expect(migration).toContain("add column if not exists cancellation_reason text");
    expect(migration).toContain("bookings_started_timestamp_consistent");
    expect(migration).toContain("bookings_delivered_timestamp_consistent");
  });

  it("adds focused reschedule history without a generic event-sourcing table", () => {
    expect(migration).toContain("create table if not exists public.booking_changes");
    expect(migration).toContain("change_type text not null");
    expect(migration).toContain("previous_scheduled_for timestamptz");
    expect(migration).toContain("new_scheduled_for timestamptz");
    expect(migration).toContain("constraint booking_changes_type_check check (change_type = 'reschedule')");
  });

  it("routes lifecycle and reschedule operations through authenticated RPCs", () => {
    expect(migration).toContain("create or replace function public.transition_booking_status");
    expect(migration).toContain("create or replace function public.reschedule_booking");
    expect(migration).toContain(
      "grant execute on function public.transition_booking_status(uuid, public.booking_status, text) to authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated",
    );
    expect(migration).toContain("booking_status_transition_requires_controlled_operation");
    expect(migration).toContain("booking_reschedule_requires_controlled_operation");
  });

  it("keeps booking changes RLS-protected and ordinary history immutable", () => {
    expect(migration).toContain("alter table public.booking_changes enable row level security");
    expect(migration).toContain("revoke all on public.booking_changes from anon, authenticated");
    expect(migration).toContain("grant select on public.booking_changes to authenticated");
    expect(migration).toContain("create policy \"Members can read booking changes\"");
    expect(migration).not.toContain("grant insert on public.booking_changes to authenticated");
  });

  it("preserves Phase 6 confirmation integrity while adding operational transitions", () => {
    expect(migration).toContain("material_changes_not_allowed_after_work_started");
    expect(migration).toContain("BOOKING_CONFIRMATION_INVALIDATED");
    expect(migration).toContain("old.status = 'READY' and new.status in ('DELIVERED', 'CANCELLED')");
    expect(migration).toContain("BOOKING_RESCHEDULED");
  });
});
